import { NextResponse } from "next/server";
import { updateHousehold } from "@/lib/db";
import { route } from "@/lib/http";

const idFrom = (req: Request) => decodeURIComponent(new URL(req.url).pathname.split("/").pop() ?? "");

export const DELETE = route(
  null,
  async ({ household }, _b, req) => {
    const id = idFrom(req);
    await updateHousehold(household.id, (h) => {
      h.mealPlan = (h.mealPlan ?? []).filter((e) => e.id !== id);
    });
    return NextResponse.json({ ok: true });
  },
  { admin: true },
);
