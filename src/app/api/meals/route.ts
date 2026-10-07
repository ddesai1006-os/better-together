import { NextResponse } from "next/server";
import { z } from "zod";
import { newId, updateHousehold } from "@/lib/db";
import { fail, route } from "@/lib/http";
import { MEAL_TYPE_IDS, normalizeRecipeUrl } from "@/lib/meals";

const Body = z.object({
  name: z.string().trim().min(1, "Give the meal a name").max(100),
  url: z.string().max(1000).default(""),
  type: z.enum(MEAL_TYPE_IDS),
});

/** Anyone in the household can suggest a meal. */
export const POST = route(Body, async ({ household, me }, b) => {
  const url = normalizeRecipeUrl(b.url);
  if (b.url.trim() && !url) return fail(400, "That recipe link doesn't look right — try pasting the full web address.");
  const id = newId("meal_");
  await updateHousehold(household.id, (h) => {
    (h.meals ??= []).push({ id, name: b.name, url, type: b.type, submittedBy: me.id, createdAt: new Date().toISOString() });
  });
  return NextResponse.json({ id });
});
