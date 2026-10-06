import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { newId, setLogin, updateHousehold, usernameTaken } from "@/lib/db";
import { fail, route } from "@/lib/http";
import type { WeeklySchedule } from "@/lib/types";
import { MemberFields, Password, Username } from "./schema";

const Body = MemberFields.extend({ username: Username, password: Password });

export const POST = route(
  Body,
  async ({ household }, b) => {
    if (await usernameTaken(b.username)) return fail(409, "That username is taken.");
    const id = newId("m_");
    const passwordHash = await bcrypt.hash(b.password, 10);
    await updateHousehold(household.id, (h) => {
      h.members.push({ ...b, id, passwordHash, schedule: b.schedule as WeeklySchedule });
    });
    await setLogin(b.username, { householdId: household.id, memberId: id });
    return NextResponse.json({ id });
  },
  { admin: true },
);
