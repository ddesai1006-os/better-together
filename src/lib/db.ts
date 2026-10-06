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
