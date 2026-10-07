import type { MealType } from "./types";

export const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snack" },
  { id: "other", label: "Other" },
];

export const MEAL_TYPE_IDS = MEAL_TYPES.map((t) => t.id) as [MealType, ...MealType[]];

export function mealType(id: MealType) {
  return MEAL_TYPES.find((t) => t.id === id) ?? MEAL_TYPES[4];
}

/** Accepts "www.site.com/recipe" or a full URL; only http(s) links are allowed. */
export function normalizeRecipeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "recipe";
  }
}
