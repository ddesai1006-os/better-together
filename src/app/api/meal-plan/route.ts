import { NextResponse } from "next/server";
import { z } from "zod";
import { addDays, todayIn, weekStart } from "@/lib/dates";
import { newId, updateHousehold } from "@/lib/db";
import { fail, route } from "@/lib/http";

const Body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), mealId: z.string().min(1) });

/** Admin places a meal idea on a day of the plan. */
export const POST = route(
  Body,
  async ({ household }, b) => {
    const res = await updateHousehold(household.id, (h) => {
      if (!h.meals?.some((m) => m.id === b.mealId)) return fail(404, "That meal idea no longer exists.");
      const plan = (h.mealPlan ??= []);
      if (!plan.some((e) => e.date === b.date && e.mealId === b.mealId)) plan.push({ id: newId("mp_"), date: b.date, mealId: b.mealId });
      // Keep the plan from growing forever: drop entries older than ~2 months.
      const cutoff = addDays(weekStart(todayIn(h.timezone)), -56);
      h.mealPlan = plan.filter((e) => e.date >= cutoff);
      return null;
    });
    return res ?? NextResponse.json({ ok: true });
  },
  { admin: true },
);
