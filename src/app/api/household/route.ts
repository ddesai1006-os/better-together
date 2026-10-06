import { NextResponse } from "next/server";
import { z } from "zod";
import { updateHousehold } from "@/lib/db";
import { fail, route } from "@/lib/http";

const Body = z.object({ name: z.string().trim().min(1).max(60), timezone: z.string() });

export const PUT = route(
  Body,
  async ({ household }, body) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: body.timezone });
    } catch {
      return fail(400, "Unknown timezone");
    }
    await updateHousehold(household.id, (h) => {
      h.name = body.name;
      h.timezone = body.timezone;
    });
    return NextResponse.json({ ok: true });
  },
  { admin: true },
);
