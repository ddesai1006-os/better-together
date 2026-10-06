import { addDays, formatMinutes, localDate, todayIn, weekStart, weekday, WEEKDAY_SHORT } from "./dates";
import { buildContext } from "./intelligence/context";
import { PILLAR_ORDER, PILLARS, SYSTEMS, systemOf } from "./systems";
import type { Household, PillarId, SystemId, Task } from "./types";

const doneOn = (t: Task, tz: string) => (t.completedAt ? localDate(t.completedAt, tz) : null);

// ------------------------------------------------------------------------- Week

export interface WeekMemberStat {
  id: string;
  done: number;
  remaining: number;
  minutes: number;
  pct: number;
  topSystem: SystemId | null;
}

export interface WeekStats {
  start: string;
  end: string;
  today: string;
  isCurrent: boolean;
  completed: Task[];
  remaining: Task[];
  pct: number;
  minutesDone: number;
  members: WeekMemberStat[];
  /** 7 days Mon→Sun; per-member completion counts. */
  days: { date: string; label: string; byMember: Record<string, number>; total: number }[];
  pillarMinutes: Record<PillarId, number>;
  streak: number;
}

export function weekStats(h: Household, offset = 0): WeekStats {
  const tz = h.timezone;
  const today = todayIn(tz);
  const start = addDays(weekStart(today), offset * 7);
  const end = addDays(start, 6);
  const inWeek = (d: string | null) => d !== null && d >= start && d <= end;

  const completed = h.tasks
    .filter((t) => t.status === "done" && inWeek(doneOn(t, tz)))
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const remaining = h.tasks
    .filter((t) => t.status === "open" && t.kind !== "idea" && t.dueDate !== null && (inWeek(t.dueDate) || (offset === 0 && t.dueDate < start)))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  const members = h.members.map((m): WeekMemberStat => {
    const mine = completed.filter((t) => t.completedBy === m.id);
    const left = remaining.filter((t) => t.assigneeId === m.id).length;
    const counts: Partial<Record<SystemId, number>> = {};
    for (const t of mine) counts[t.system] = (counts[t.system] ?? 0) + t.estimateMinutes;
    const top = (Object.entries(counts) as [SystemId, number][]).sort((a, b) => b[1] - a[1])[0];
    return {
      id: m.id,
      done: mine.length,
      remaining: left,
      minutes: mine.reduce((s, t) => s + t.estimateMinutes, 0),
      pct: mine.length + left ? Math.round((mine.length / (mine.length + left)) * 100) : 0,
      topSystem: top?.[0] ?? null,
    };
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const byMember: Record<string, number> = {};
    for (const t of completed) if (doneOn(t, tz) === date && t.completedBy) byMember[t.completedBy] = (byMember[t.completedBy] ?? 0) + 1;
    return { date, label: WEEKDAY_SHORT[weekday(date)], byMember, total: Object.values(byMember).reduce((a, b) => a + b, 0) };
  });

  const pillarMinutes = { engine: 0, foundation: 0, goodlife: 0 } as Record<PillarId, number>;
  for (const t of completed) pillarMinutes[systemOf(t.system).pillar] += t.estimateMinutes;

  const activeDays = new Set(h.tasks.filter((t) => t.status === "done").map((t) => doneOn(t, tz)));
  let streak = 0;
  for (let d = activeDays.has(today) ? today : addDays(today, -1); activeDays.has(d); d = addDays(d, -1)) streak++;

  const total = completed.length + remaining.length;
  return {
    start, end, today, isCurrent: offset === 0, completed, remaining,
    pct: total ? Math.round((completed.length / total) * 100) : 0,
    minutesDone: completed.reduce((s, t) => s + t.estimateMinutes, 0),
    members, days, pillarMinutes, streak,
  };
}

// --------------------------------------------------------------------- Rhythms

export interface Insight {
  tone: "good" | "heads-up" | "idea";
  title: string;
  body: string;
}

export interface RhythmStats {
  weeks: number;
  from: string;
  to: string;
  totalTasks: number;
  totalMinutes: number;
  /** Mon→Sun average completions per member. */
  typicalWeek: { label: string; byMember: Record<string, number>; total: number; minutes: number }[];
  systems: { id: SystemId; count: number; minutes: number; byMember: Record<string, number>; leadId: string | null; leadShare: number }[];
  pillars: { id: PillarId; minutes: number; share: number }[];
  fairness: { id: string; minutesShare: number; capacityShare: number; heavyShare: number; minutes: number }[];
  routines: ReturnType<typeof buildContext>["routines"];
  weeklyTotals: { start: string; count: number; minutes: number }[];
  insights: Insight[];
}

export function rhythmStats(h: Household, weeks = 6): RhythmStats {
  const tz = h.timezone;
  const today = todayIn(tz);
  const to = addDays(weekStart(today), -1); // through last Sunday: full weeks only
  const from = addDays(to, -weeks * 7 + 1);
  const done = h.tasks.filter((t) => {
    const d = doneOn(t, tz);
    return t.status === "done" && t.completedBy && d && d >= from && d <= to;
  });
  const totalMinutes = done.reduce((s, t) => s + t.estimateMinutes, 0);
  const name = (id: string) => h.members.find((m) => m.id === id)?.name ?? "Someone";

  const order = [1, 2, 3, 4, 5, 6, 0];
  const typicalWeek = order.map((wd) => {
    const byMember: Record<string, number> = {};
    let minutes = 0;
    for (const t of done) {
      if (weekday(doneOn(t, tz)!) !== wd) continue;
      byMember[t.completedBy!] = (byMember[t.completedBy!] ?? 0) + 1 / weeks;
      minutes += t.estimateMinutes / weeks;
    }
    return { label: WEEKDAY_SHORT[wd], byMember, total: Object.values(byMember).reduce((a, b) => a + b, 0), minutes };
  });

  const systems = SYSTEMS.map((s) => {
    const mine = done.filter((t) => t.system === s.id);
    const byMember: Record<string, number> = {};
    for (const t of mine) byMember[t.completedBy!] = (byMember[t.completedBy!] ?? 0) + t.estimateMinutes;
    const minutes = mine.reduce((a, t) => a + t.estimateMinutes, 0);
    const lead = Object.entries(byMember).sort((a, b) => b[1] - a[1])[0];
    return { id: s.id, count: mine.length, minutes, byMember, leadId: lead?.[0] ?? null, leadShare: lead && minutes ? lead[1] / minutes : 0 };
  });

  const pillars = PILLAR_ORDER.map((p) => {
    const minutes = systems.filter((s) => systemOf(s.id).pillar === p).reduce((a, s) => a + s.minutes, 0);
    return { id: p, minutes, share: totalMinutes ? minutes / totalMinutes : 0 };
  });

  const totalCapacity = h.members.reduce((a, m) => a + m.schedule.reduce((x, y) => x + y, 0), 0);
  const heavyDone = done.filter((t) => t.cognitiveLoad === "heavy");
  const fairness = h.members.map((m) => {
    const minutes = done.filter((t) => t.completedBy === m.id).reduce((a, t) => a + t.estimateMinutes, 0);
    return {
      id: m.id,
      minutes,
      minutesShare: totalMinutes ? minutes / totalMinutes : 0,
      capacityShare: totalCapacity ? m.schedule.reduce((x, y) => x + y, 0) / totalCapacity : 0,
      heavyShare: heavyDone.length ? heavyDone.filter((t) => t.completedBy === m.id).length / heavyDone.length : 0,
    };
  });

  const weeklyTotals = Array.from({ length: weeks }, (_, i) => {
    const s = addDays(from, i * 7);
    const e = addDays(s, 6);
    const inW = done.filter((t) => doneOn(t, tz)! >= s && doneOn(t, tz)! <= e);
    return { start: s, count: inW.length, minutes: inW.reduce((a, t) => a + t.estimateMinutes, 0) };
  });

  const routines = buildContext(h, weeks * 7).routines.filter((r) => r.frequency);

  // ---- Plain-language insights
  const insights: Insight[] = [];
  const busiest = [...typicalWeek].sort((a, b) => b.minutes - a.minutes)[0];
  const quietest = [...typicalWeek].sort((a, b) => a.minutes - b.minutes)[0];
  if (busiest && busiest.minutes > 0) {
    insights.push({
      tone: "idea",
      title: `${busiest.label} is your household's power day`,
      body: `About ${formatMinutes(busiest.minutes)} of work typically lands on ${busiest.label}, versus ${formatMinutes(quietest.minutes)} on ${quietest.label}. Moving a routine or two to ${quietest.label} could take the edge off.`,
    });
  }
  for (const f of fairness) {
    const gap = f.minutesShare - f.capacityShare;
    if (gap > 0.08) {
      insights.push({
        tone: "heads-up",
        title: `${name(f.id)} is carrying more than their share`,
        body: `${name(f.id)} did ${Math.round(f.minutesShare * 100)}% of household minutes but has ${Math.round(f.capacityShare * 100)}% of the available time. New one-off tasks will lean toward whoever has room.`,
      });
    }
  }
  const heavyLead = [...fairness].sort((a, b) => b.heavyShare - a.heavyShare)[0];
  if (heavyLead && heavyLead.heavyShare >= 0.5 && heavyDone.length >= 4) {
    insights.push({
      tone: "heads-up",
      title: `Most of the mental load sits with ${name(heavyLead.id)}`,
      body: `${Math.round(heavyLead.heavyShare * 100)}% of high-cognitive-load tasks (planning, research, money decisions) were handled by ${name(heavyLead.id)}. That invisible work counts too.`,
    });
  }
  const goodLife = pillars.find((p) => p.id === "goodlife")!;
  if (goodLife.share < 0.2) {
    insights.push({
      tone: "idea",
      title: "Room for more Good Life",
      body: `Only ${Math.round(goodLife.share * 100)}% of your time goes to experiences, learning, and relationships. Even one small adventure on the calendar counts.`,
    });
  } else {
    insights.push({
      tone: "good",
      title: "You're making space for the good stuff",
      body: `${Math.round(goodLife.share * 100)}% of household time goes to ${PILLARS.goodlife.name} — experiences, learning, and relationships.`,
    });
  }
  const steady = routines.filter((r) => r.ownerShare >= 0.8).length;
  if (steady) {
    insights.push({
      tone: "good",
      title: `${steady} routines run like clockwork`,
      body: `These have a clear owner most of the time, so they get done without anyone having to ask. Better Together keeps sending them to the same person.`,
    });
  }

  return { weeks, from, to, totalTasks: done.length, totalMinutes, typicalWeek, systems, pillars, fairness, routines, weeklyTotals, insights };
}
