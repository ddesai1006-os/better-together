import { NextResponse } from "next/server";
import { updateHousehold } from "@/lib/db";
import { fail, route } from "@/lib/http";

const idFrom = (req: Request) => decodeURIComponent(new URL(req.url).pathname.split("/").pop() ?? "");

/** People can remove their own ideas; the admin can remove any. Also clears it from the plan. */
export const DELETE = route(null, async ({ household, me, isAdmin }, _b, req) => {
  const id = idFrom(req);
  const res = await updateHousehold(household.id, (h) => {
    const meal = h.meals?.find((m) => m.id === id);
    if (!meal) return null;
    if (!isAdmin && meal.submittedBy !== me.id) return fail(403, "You can only remove ideas you added.");
    h.meals = h.meals!.filter((m) => m.id !== id);
    h.mealPlan = (h.mealPlan ?? []).filter((e) => e.mealId !== id);
    return null;
  });
  return res ?? NextResponse.json({ ok: true });
});
