import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { removeLogin, updateHousehold } from "@/lib/db";
import { fail, route } from "@/lib/http";
import type { WeeklySchedule } from "@/lib/types";
import { MemberFields, Password } from "../schema";

const idFrom = (req: Request) => decodeURIComponent(new URL(req.url).pathname.split("/").pop() ?? "");

const Patch = MemberFields.extend({ password: z.union([Password, z.literal("")]).optional() });

export const PATCH = route(
  Patch,
  async ({ household, me }, b, req) => {
    const id = idFrom(req);
    const passwordHash = b.password ? await bcrypt.hash(b.password, 10) : null;
    const res = await updateHousehold(household.id, (h) => {
      const m = h.members.find((x) => x.id === id);
      if (!m) return fail(404, "Member not found");
      if (m.id === me.id && b.role !== "admin") return fail(400, "You can't remove your own admin role.");
      const { password: _p, ...fields } = b;
      Object.assign(m, fields, { schedule: b.schedule as WeeklySchedule });
      if (passwordHash) m.passwordHash = passwordHash;
      return null;
    });
    return res ?? NextResponse.json({ ok: true });
  },
  { admin: true },
);

export const DELETE = route(
  null,
  async ({ household, me }, _b, req) => {
    const id = idFrom(req);
    if (id === me.id) return fail(400, "You can't remove yourself.");
    const removed = await updateHousehold(household.id, (h) => {
      const m = h.members.find((x) => x.id === id);
      if (!m) return null;
      h.members = h.members.filter((x) => x.id !== id);
      // Their open work goes back to the admin so nothing falls through the cracks.
      for (const t of h.tasks) if (t.status === "open" && t.assigneeId === id) t.assigneeId = me.id;
      return m.username;
    });
    if (removed) await removeLogin(removed);
    return NextResponse.json({ ok: true });
  },
  { admin: true },
);
