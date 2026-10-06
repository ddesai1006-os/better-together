import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { ensureDemo, findLogin, getHousehold, memberById } from "@/lib/db";
import { fail } from "@/lib/http";

const Body = z.object({ username: z.string().min(1), password: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "Enter your username and password.");
  await ensureDemo();
  const ref = await findLogin(parsed.data.username);
  const household = ref && (await getHousehold(ref.householdId));
  const member = household && memberById(household, ref.memberId);
  if (!member || !(await bcrypt.compare(parsed.data.password, member.passwordHash))) {
    return fail(401, "That username and password don't match.");
  }
  await createSession({ householdId: household.id, memberId: member.id });
  return NextResponse.json({ ok: true });
}
