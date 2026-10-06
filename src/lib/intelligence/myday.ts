import { addDays, daysBetween, localDate, todayIn } from "../dates";
import type { Household, Member, Task } from "../types";

const PRIORITY_WEIGHT = { high: 30, medium: 18, low: 8 } as const;

function urgencyScore(t: Task, today: string): number {
  let s = PRIORITY_WEIGHT[t.priority];
  if (t.dueDate) {
    const d = daysBetween(today, t.dueDate);
    if (d < 0) s += 25 + Math.min(10, -d * 2); // overdue
    else if (d === 0) s += 22;
    else if (d === 1) s += 12;
    else if (d <= 3) s += 6;
    else s -= Math.min(10, d);
  }
  if (t.kind === "reminder") s += 4;
  s += Math.min(6, t.skipCount * 2); // skipped things gently float back up
  return s;
}

export interface MyDay {
  today: string;
  focus: Task[];
  doneToday: Task[];
  /** Count of eligible tasks not shown, for a "pull one more" affordance. */
  more: number;
  capacityMinutes: number;
}

/**
 * Picks 3–5 things for today: the most urgent first, respecting the member's daily
 * limit and available minutes, and never stacking more than two heavy lifts.
 */
export function buildMyDay(h: Household, member: Member, extra = 0): MyDay {
  const today = todayIn(h.timezone);
  const capacityMinutes = member.schedule[new Date(`${today}T12:00:00Z`).getUTCDay()];
  const doneToday = h.tasks.filter(
    (t) => t.status === "done" && t.completedBy === member.id && t.completedAt && localDate(t.completedAt, h.timezone) === today,
  );
  const horizon = addDays(today, 7);
  const eligible = h.tasks
    .filter(
      (t) =>
        t.status === "open" &&
        t.kind !== "idea" &&
        t.assigneeId === member.id &&
        t.skippedOn !== today &&
        // Routines surface on (or the day before) their day; one-offs can be pulled forward a week.
        (t.kind === "recurring" ? (t.dueDate ?? today) <= addDays(today, t.frequency === "daily" ? 0 : 1) : !t.dueDate || t.dueDate <= horizon),
    )
    .map((t) => ({ t, s: urgencyScore(t, today) }))
    .sort((a, b) => b.s - a.s);

  const limit = Math.max(0, member.dailyTaskLimit - doneToday.length) + extra;
  const usedMinutes = doneToday.reduce((s, t) => s + t.estimateMinutes, 0);
  const focus: Task[] = [];
  let minutes = usedMinutes;
  let heavy = 0;
  for (const { t } of eligible) {
    if (focus.length >= limit) break;
    const mustDo = t.dueDate !== null && t.dueDate <= today;
    if (!mustDo && t.cognitiveLoad === "heavy" && heavy >= 2) continue;
    if (!mustDo && focus.length >= 3 && minutes + t.estimateMinutes > capacityMinutes) continue;
    focus.push(t);
    minutes += t.estimateMinutes;
    if (t.cognitiveLoad === "heavy") heavy++;
  }
  return { today, focus, doneToday, more: eligible.length - focus.length, capacityMinutes };
}
