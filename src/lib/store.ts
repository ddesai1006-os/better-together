import "server-only";
import { Redis } from "@upstash/redis";
import { promises as fs } from "fs";
import path from "path";

/**
 * Tiny key/value store. Uses Upstash Redis (Vercel Marketplace) when its env vars are
 * present; otherwise a JSON file on disk so local dev needs zero setup.
 */
interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
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

const globalForKV = globalThis as unknown as { __btKV?: KV };
export const kv: KV = globalForKV.__btKV ?? (globalForKV.__btKV = redisUrl && redisToken ? redisStore() : fileStore());
export const usingDurableStore = Boolean(redisUrl && redisToken);
