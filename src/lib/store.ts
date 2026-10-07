import "server-only";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { promises as fs } from "fs";
import path from "path";

/**
 * Tiny key/value store. Uses Supabase or Upstash Redis (both via the Vercel Marketplace)
 * when their env vars are present; otherwise a JSON file on disk so local dev needs zero setup.
 */
interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
}

// Server-only key: bypasses row-level security, so it must never reach the browser.
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const SUPABASE_TABLE = "bt_kv";

function supabaseStore(): KV {
  const db = createClient(supabaseUrl!, supabaseKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const check = (error: { message: string; code?: string } | null) => {
    if (!error) return;
    if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message)) {
      throw new Error(`Supabase table "${SUPABASE_TABLE}" is missing — run supabase/setup.sql in the Supabase SQL Editor.`);
    }
    throw new Error(`Supabase: ${error.message}`);
  };
  return {
    get: async <T,>(key: string) => {
      const { data, error } = await db.from(SUPABASE_TABLE).select("value").eq("key", key).maybeSingle();
      check(error);
      return (data?.value as T) ?? null;
    },
    set: async (key, value) => {
      const { error } = await db.from(SUPABASE_TABLE).upsert({ key, value, updated_at: new Date().toISOString() });
      check(error);
    },
    del: async (key) => {
      const { error } = await db.from(SUPABASE_TABLE).delete().eq("key", key);
      check(error);
    },
  };
}

const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

function redisStore(): KV {
  const redis = new Redis({ url: redisUrl!, token: redisToken! });
  return {
    get: (key) => redis.get(key),
    set: async (key, value) => {
      await redis.set(key, value);
    },
    del: async (key) => {
      await redis.del(key);
    },
  };
}

function fileStore(): KV {
  // Vercel's filesystem is read-only outside /tmp (and /tmp is ephemeral) — fine as a fallback only.
  const file = process.env.VERCEL ? "/tmp/better-together.json" : path.join(process.cwd(), ".data", "db.json");
  let cache: Record<string, unknown> | null = null;
  let writing: Promise<void> = Promise.resolve();

  async function load() {
    if (cache) return cache;
    try {
      cache = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      cache = {};
    }
    return cache!;
  }
  async function flush() {
    const snapshot = JSON.stringify(cache);
    writing = writing.then(async () => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, snapshot);
    });
    await writing;
  }
  return {
    get: async <T,>(key: string) => ((await load())[key] as T) ?? null,
    set: async (key, value) => {
      (await load())[key] = structuredClone(value);
      await flush();
    },
    del: async (key) => {
      delete (await load())[key];
      await flush();
    },
  };
}

export const storeKind: "supabase" | "upstash" | "file" =
  supabaseUrl && supabaseKey ? "supabase" : redisUrl && redisToken ? "upstash" : "file";
export const usingDurableStore = storeKind !== "file";

const globalForKV = globalThis as unknown as { __btKV?: KV };
export const kv: KV =
  globalForKV.__btKV ??
  (globalForKV.__btKV = storeKind === "supabase" ? supabaseStore() : storeKind === "upstash" ? redisStore() : fileStore());
