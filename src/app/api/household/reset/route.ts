import { NextResponse } from "next/server";
import { seedDemo } from "@/lib/db";
import { fail, route } from "@/lib/http";

/** Re-seeds the demo household relative to today (demo household only). */
export const POST = route(
  null,
  async ({ household }) => {
    if (household.id !== "demo") return fail(400, "Only the demo household can be reset.");
    await seedDemo(household.id);
    return NextResponse.json({ ok: true });
  },
  { admin: true },
);
