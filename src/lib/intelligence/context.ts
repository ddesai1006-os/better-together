import { addDays, localDate, todayIn, weekday } from "../dates";
import { titleKey } from "../tasks";
import type { Frequency, Household, SystemId } from "../types";

export interface MemberLoad {
  id: string;
  name: string;
  role: string;
  preferredSystems: SystemId[];
  notes: string;
  capacityWeekMin: number;
  capacityTodayMin: number;
  /** Open work assigned and due in the next 7 days (or undated). */
  openMinutes: number;
  openCount: number;
  /** openMinutes / capacityWeekMin — above 1 means over capacity. */
  loadRatio: number;
  doneMinutes28d: number;
}

export interface Routine {
  key: string;
  title: string;
  system: SystemId;
  frequency: Frequency | null;
  usualOwnerId: string;
  ownerShare: number;
  timesDone: number;
  avgMinutes: number;
}

export interface HouseholdContext {
  today: string;
  weekdayName: string;
  members: MemberLoad[];
  /** Per system: each member's share of completions over the history window. */
  systemShares: Partial<Record<SystemId, Record<string, number>>>;
  routines: Routine[];
  /** titleKey → member id the household explicitly chose over the AI's suggestion. */
  learnedOverrides: Record<string, string>;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function buildContext(h: Household, historyDays = 56): HouseholdContext {
  const today = todayIn(h.timezone);
  const horizon = addDays(today, 7);
  const since = addDays(today, -historyDays);
  const since28 = addDays(today, -28);

  const members: MemberLoad[] = h.members.map((m) => {
    const open = h.tasks.filter(
      (t) => t.status === "open" && t.kind !== "idea" && t.assigneeId === m.id && (!t.dueDate || t.dueDate <= horizon),
    );
    const openMinutes = open.reduce((s, t) => s + t.estimateMinutes, 0);
    const capacityWeekMin = m.schedule.reduce((a, b) => a + b, 0);
    const doneMinutes28d = h.tasks
      .filter((t) => t.status === "done" && t.completedBy === m.id && t.completedAt && localDate(t.completedAt, h.timezone) >= since28)
      .reduce((s, t) => s + t.estimateMinutes, 0);
    return {
      id: m.id,
      name: m.name,
      role: m.role,
      preferredSystems: m.preferredSystems,
      notes: m.notes,
      capacityWeekMin,
      capacityTodayMin: m.schedule[weekday(today)],
      openMinutes,
      openCount: open.length,
      loadRatio: capacityWeekMin ? openMinutes / capacityWeekMin : 1,
      doneMinutes28d,
    };
  });

  const done = h.tasks.filter((t) => t.status === "done" && t.completedBy && t.completedAt && localDate(t.completedAt, h.timezone) >= since);

  const systemCounts: Partial<Record<SystemId, Record<string, number>>> = {};
  for (const t of done) {
    const row = (systemCounts[t.system] ??= {});
    row[t.completedBy!] = (row[t.completedBy!] ?? 0) + 1;
  }
  const systemShares: HouseholdContext["systemShares"] = {};
  for (const [sys, row] of Object.entries(systemCounts) as [SystemId, Record<string, number>][]) {
    const total = Object.values(row).reduce((a, b) => a + b, 0);
    systemShares[sys] = Object.fromEntries(Object.entries(row).map(([id, c]) => [id, Math.round((c / total) * 100) / 100]));
  }

  const groups = new Map<string, { title: string; system: SystemId; freq: Frequency | null; by: Record<string, number>; minutes: number; n: number; recurring: boolean }>();
  for (const t of done) {
    const key = titleKey(t.title);
    const g = groups.get(key) ?? { title: t.title, system: t.system, freq: t.frequency, by: {}, minutes: 0, n: 0, recurring: false };
    g.by[t.completedBy!] = (g.by[t.completedBy!] ?? 0) + 1;
    g.minutes += t.estimateMinutes;
    g.n += 1;
    g.recurring ||= t.kind === "recurring";
    groups.set(key, g);
  }
  const routines: Routine[] = [...groups.entries()]
    .filter(([, g]) => g.recurring || g.n >= 3)
    .map(([key, g]) => {
      const [owner, count] = Object.entries(g.by).sort((a, b) => b[1] - a[1])[0];
      return { key, title: g.title, system: g.system, frequency: g.freq, usualOwnerId: owner, ownerShare: count / g.n, timesDone: g.n, avgMinutes: Math.round(g.minutes / g.n) };
    })
    .sort((a, b) => b.timesDone - a.timesDone);

  const learnedOverrides: Record<string, string> = {};
  for (const s of h.signals.slice(-50)) learnedOverrides[s.titleKey] = s.chosenId;

  return { today, weekdayName: WEEKDAY_NAMES[weekday(today)], members, systemShares, routines, learnedOverrides };
}
