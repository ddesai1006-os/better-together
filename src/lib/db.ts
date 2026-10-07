import "server-only";
import { kv } from "./store";
import type { Household, Member } from "./types";
import { buildDemoHousehold, DEMO_USERNAMES } from "./seed";

interface LoginRef {
  householdId: string;
  memberId: string;
}

const hhKey = (id: string) => `household:${id}`;
const loginKey = (username: string) => `login:${username.trim().toLowerCase()}`;

export function newId(prefix = ""): string {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function getHousehold(id: string): Promise<Household | null> {
  return kv.get<Household>(hhKey(id));
}

export async function saveHousehold(h: Household): Promise<void> {
  await kv.set(hhKey(h.id), h);
}

/** Load → mutate → save. The mutator may return a value that is passed through. */
export async function updateHousehold<T>(id: string, fn: (h: Household) => T | Promise<T>): Promise<T> {
  const h = await getHousehold(id);
  if (!h) throw new Error("Household not found");
  const result = await fn(h);
  await saveHousehold(h);
  return result;
}

export async function findLogin(username: string): Promise<LoginRef | null> {
  return kv.get<LoginRef>(loginKey(username));
}

export async function setLogin(username: string, ref: LoginRef) {
  await kv.set(loginKey(username), ref);
}

export async function removeLogin(username: string) {
  await kv.del(loginKey(username));
}

export async function usernameTaken(username: string) {
  return Boolean(await findLogin(username));
}

/** Creates (or recreates) the demo household so the app is explorable on first run. */
export async function seedDemo(existingId?: string): Promise<Household> {
  const h = await buildDemoHousehold(existingId ?? "demo");
  await saveHousehold(h);
  for (const m of h.members) await setLogin(m.username, { householdId: h.id, memberId: m.id });
  return h;
}

export async function ensureDemo() {
  if (!(await findLogin(DEMO_USERNAMES[0]))) await seedDemo();
}

export function memberById(h: Household, id: string | null | undefined): Member | undefined {
  return h.members.find((m) => m.id === id);
}

// ---- Personal keys (Siri Shortcut). Only a SHA-256 of the key is stored. --------------

interface KeyRef {
  householdId: string;
  memberId: string;
}
const keyIndex = (hash: string) => `apikey:${hash}`;

export async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Buffer.from(digest).toString("hex");
}

/** Creates a new key for a member (replacing any old one) and returns it — the only time it's visible. */
export async function issueKey(householdId: string, memberId: string): Promise<string> {
  const key = `bt_${Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url")}`;
  const hash = await hashKey(key);
  const old = await updateHousehold(householdId, (h) => {
    const m = h.members.find((x) => x.id === memberId);
    if (!m) throw new Error("Member not found");
    const prev = m.apiKeyHash ?? null;
    m.apiKeyHash = hash;
    m.apiKeyCreatedAt = new Date().toISOString();
    return prev;
  });
  if (old) await kv.del(keyIndex(old));
  await kv.set(keyIndex(hash), { householdId, memberId } satisfies KeyRef);
  return key;
}

export async function revokeKey(householdId: string, memberId: string) {
  const old = await updateHousehold(householdId, (h) => {
    const m = h.members.find((x) => x.id === memberId);
    const prev = m?.apiKeyHash ?? null;
    if (m) {
      m.apiKeyHash = null;
      m.apiKeyCreatedAt = null;
    }
    return prev;
  });
  if (old) await kv.del(keyIndex(old));
}

export async function resolveKey(key: string): Promise<KeyRef | null> {
  if (!/^bt_[A-Za-z0-9_-]{20,}$/.test(key)) return null;
  const hash = await hashKey(key);
  const ref = await kv.get<KeyRef>(keyIndex(hash));
  if (!ref) return null;
  // Double-check against the member record so a stale index entry can't be used.
  const h = await getHousehold(ref.householdId);
  const m = h?.members.find((x) => x.id === ref.memberId);
  return m?.apiKeyHash === hash ? ref : null;
}
