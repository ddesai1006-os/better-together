import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getHousehold, memberById } from "./db";
import type { Household, Member, SessionUser } from "./types";

const COOKIE = "bt_session";
if (!process.env.SESSION_SECRET && process.env.VERCEL_ENV === "production") {
  // A guessable secret would let anyone forge a session.
  throw new Error("SESSION_SECRET must be set in production.");
}
const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-only-secret-change-me-in-production-please");

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function readSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return { householdId: String(payload.householdId), memberId: String(payload.memberId) };
  } catch {
    return null;
  }
}

export interface Viewer {
  household: Household;
  me: Member;
  isAdmin: boolean;
}

/** For pages: resolves the signed-in member or redirects to /login. */
export async function requireViewer(): Promise<Viewer> {
  const v = await currentViewer();
  if (!v) redirect("/login");
  return v;
}

/** For route handlers: returns null when unauthenticated. */
export async function currentViewer(): Promise<Viewer | null> {
  const s = await readSession();
  if (!s) return null;
  const household = await getHousehold(s.householdId);
  const me = household && memberById(household, s.memberId);
  if (!household || !me) return null;
  return { household, me, isAdmin: me.role === "admin" };
}

export function publicMember(m: Member) {
  const { passwordHash: _omit, apiKeyHash: _key, ...rest } = m;
  return rest;
}
export type PublicMember = ReturnType<typeof publicMember>;
