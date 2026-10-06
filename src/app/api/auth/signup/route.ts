import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { newId, saveHousehold, setLogin, usernameTaken } from "@/lib/db";
import { fail } from "@/lib/http";
import { MEMBER_COLORS } from "@/lib/systems";
import type { Household } from "@/lib/types";

const Body = z.object({
  householdName: z.string().trim().min(1, "Name your household").max(60),
  name: z.string().trim().min(1, "Add your name").max(40),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,24}$/, "Usernames are 3–24 letters, numbers, . _ or -"),
  password: z.string().min(8, "Passwords need at least 8 characters"),
  timezone: z.string().default("America/New_York"),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Check the form");
  const b = parsed.data;
  if (await usernameTaken(b.username)) return fail(409, "That username is taken.");
  let tz = b.timezone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    tz = "America/New_York";
  }
  const memberId = newId("m_");
  const household: Household = {
    id: newId("h_"),
    name: b.householdName,
    timezone: tz,
    createdAt: new Date().toISOString(),
    members: [
      {
        id: memberId, name: b.name, username: b.username, passwordHash: await bcrypt.hash(b.password, 10),
        role: "admin", color: MEMBER_COLORS[0], emoji: "🌻", dailyTaskLimit: 5,
        schedule: [120, 60, 60, 60, 60, 60, 120], preferredSystems: [], notes: "",
      },
    ],
    tasks: [],
    signals: [],
  };
  await saveHousehold(household);
  await setLogin(b.username, { householdId: household.id, memberId });
  await createSession({ householdId: household.id, memberId });
  return NextResponse.json({ ok: true });
}
