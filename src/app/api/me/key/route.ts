import { NextResponse } from "next/server";
import { issueKey, revokeKey } from "@/lib/db";
import { route } from "@/lib/http";

/** Each member manages their own personal key for the Siri Shortcut. */
export const POST = route(null, async ({ household, me }) => {
  const key = await issueKey(household.id, me.id);
  return NextResponse.json({ key });
});

export const DELETE = route(null, async ({ household, me }) => {
  await revokeKey(household.id, me.id);
  return NextResponse.json({ ok: true });
});
