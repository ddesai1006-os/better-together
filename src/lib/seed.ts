import bcrypt from "bcryptjs";
import { addDays, todayIn, weekday } from "./dates";
import { MEMBER_COLORS } from "./systems";
import { makeTask, nextDue } from "./tasks";
import type { CognitiveLoad, Frequency, Household, Member, Priority, SystemId, Task } from "./types";

/**
 * Demo household with ~6 weeks of believable history so the Weekly Dashboard and
 * Household Rhythms have patterns to show on first run. Credentials live here (and in
 * the README) — they are demo-only.
 */
export const DEMO_PASSWORD = "together";
export const DEMO_USERNAMES = ["maya", "sam", "leo"];
const HISTORY_DAYS = 42;

type Owners = Partial<Record<"maya" | "sam" | "leo", number>>;

interface Routine {
  title: string;
  system: SystemId;
  freq: Frequency;
  wd: number; // weekday anchor (ignored for daily)
  min: number;
  load: CognitiveLoad;
  pri: Priority;
  owners: Owners;
  ctx?: string;
}

const ROUTINES: Routine[] = [
  { title: "Weekly meal plan", system: "meals", freq: "weekly", wd: 0, min: 30, load: "moderate", pri: "medium", owners: { maya: 0.9, sam: 0.1 }, ctx: "Check the calendar for busy nights first — those are slow-cooker nights." },
  { title: "Grocery shopping", system: "meals", freq: "weekly", wd: 6, min: 60, load: "moderate", pri: "high", owners: { maya: 0.7, sam: 0.3 }, ctx: "Whole Foods on Main St — list is on the fridge." },
  { title: "Sunday batch-cook lunches", system: "meals", freq: "weekly", wd: 0, min: 60, load: "moderate", pri: "medium", owners: { sam: 0.8, maya: 0.2 } },
  { title: "Midweek laundry load", system: "laundry", freq: "weekly", wd: 3, min: 45, load: "light", pri: "medium", owners: { sam: 0.6, maya: 0.4 } },
  { title: "Weekend laundry + sheets", system: "laundry", freq: "weekly", wd: 6, min: 50, load: "light", pri: "medium", owners: { maya: 0.7, sam: 0.3 } },
  { title: "Put away your laundry", system: "laundry", freq: "weekly", wd: 0, min: 15, load: "light", pri: "low", owners: { leo: 0.95, maya: 0.05 } },
  { title: "Take out trash & recycling", system: "maintenance", freq: "weekly", wd: 2, min: 10, load: "light", pri: "medium", owners: { leo: 0.8, sam: 0.2 }, ctx: "Recycling goes out Tuesday night." },
  { title: "Clean bathrooms", system: "maintenance", freq: "weekly", wd: 6, min: 40, load: "moderate", pri: "medium", owners: { maya: 0.75, sam: 0.25 } },
  { title: "Water the plants", system: "maintenance", freq: "weekly", wd: 4, min: 10, load: "light", pri: "low", owners: { leo: 0.9, maya: 0.1 } },
  { title: "Review & pay bills", system: "admin", freq: "weekly", wd: 5, min: 20, load: "heavy", pri: "high", owners: { sam: 0.85, maya: 0.15 } },
  { title: "Family calendar sync", system: "alignment", freq: "weekly", wd: 0, min: 20, load: "moderate", pri: "medium", owners: { maya: 0.95, sam: 0.05 }, ctx: "Cover pickups, practices, and who has the car." },
  { title: "Budget check-in", system: "budget", freq: "biweekly", wd: 4, min: 30, load: "heavy", pri: "medium", owners: { sam: 0.7, maya: 0.3 } },
  { title: "Family evening walk", system: "health", freq: "weekly", wd: 3, min: 30, load: "light", pri: "low", owners: { sam: 0.5, maya: 0.5 } },
  { title: "Family game night", system: "relationships", freq: "weekly", wd: 5, min: 90, load: "light", pri: "low", owners: { maya: 0.6, sam: 0.4 } },
  { title: "Call Grandma", system: "relationships", freq: "weekly", wd: 0, min: 20, load: "light", pri: "low", owners: { maya: 0.7, leo: 0.3 } },
  { title: "Plan a weekend outing", system: "experiences", freq: "biweekly", wd: 3, min: 30, load: "moderate", pri: "low", owners: { maya: 0.85, sam: 0.15 } },
  { title: "Piano practice", system: "learning", freq: "daily", wd: 0, min: 20, load: "light", pri: "low", owners: { leo: 1 } },
];

const ONE_OFFS: Array<[string, SystemId, number, CognitiveLoad]> = [
  ["Renew car registration", "admin", 20, "heavy"],
  ["Fix squeaky closet door", "maintenance", 15, "light"],
  ["Return package to UPS", "calendar", 20, "light"],
  ["Donate outgrown clothes", "organization", 40, "moderate"],
  ["Replace smoke detector batteries", "maintenance", 15, "light"],
  ["Order school supplies", "admin", 20, "light"],
  ["Declutter garage shelf", "organization", 60, "moderate"],
  ["Research 529 contribution", "budget", 45, "heavy"],
  ["Sign field trip permission slip", "admin", 5, "light"],
  ["Get oil change", "maintenance", 60, "light"],
  ["Plan Mom's birthday dinner", "relationships", 30, "moderate"],
  ["Organize pantry", "organization", 45, "moderate"],
  ["Library trip", "learning", 45, "light"],
  ["Pick up prescriptions", "health", 20, "light"],
  ["Cancel unused streaming subscription", "budget", 10, "light"],
  ["Schedule pediatrician check-up", "health", 10, "moderate"],
  ["Try a new hiking trail", "experiences", 120, "light"],
  ["Coordinate carpool for soccer", "calendar", 15, "heavy"],
  ["Book haircut appointments", "calendar", 10, "light"],
  ["Restock first-aid kit", "health", 15, "light"],
];
const ONE_OFF_OWNERS: Owners = { maya: 0.7, sam: 0.24, leo: 0.06 };

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export async function buildDemoHousehold(id: string): Promise<Household> {
  const tz = process.env.DEMO_TIMEZONE ?? "America/New_York";
  const today = todayIn(tz);
  const rand = rng(20261006);
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  let n = 0;
  const nid = () => `t${(++n).toString(36)}${Math.floor(rand() * 1e6).toString(36)}`;

  const mk = (key: string, name: string, role: Member["role"], i: number, extra: Partial<Member>): Member => ({
    id: `m_${key}`,
    name,
    username: key,
    passwordHash: hash,
    role,
    color: MEMBER_COLORS[i],
    emoji: ["🌻", "🌿", "🚀"][i],
    dailyTaskLimit: 5,
    schedule: [120, 60, 60, 60, 60, 60, 120],
    preferredSystems: [],
    notes: "",
    ...extra,
  });

  const members: Member[] = [
    mk("maya", "Maya", "admin", 0, {
      schedule: [150, 90, 75, 90, 75, 60, 150],
      preferredSystems: ["meals", "alignment", "experiences", "relationships"],
      notes: "Works from home Tue/Thu.",
    }),
    mk("sam", "Sam", "member", 1, {
      schedule: [180, 60, 60, 45, 60, 60, 180],
      preferredSystems: ["admin", "budget", "maintenance", "laundry"],
      notes: "Commutes Mon/Wed/Fri — evenings only on those days.",
    }),
    mk("leo", "Leo", "member", 2, {
      dailyTaskLimit: 3,
      schedule: [60, 30, 30, 30, 30, 45, 60],
      preferredSystems: ["learning", "maintenance"],
      notes: "15 years old. Soccer practice Mon/Wed. Keep tasks light on school nights.",
    }),
  ];

  const pick = (owners: Owners): string => {
    let r = rand();
    for (const [k, p] of Object.entries(owners)) {
      if ((r -= p!) <= 0) return `m_${k}`;
    }
    return `m_${Object.keys(owners)[0]}`;
  };
  const stamp = (date: string) => `${date}T${String(13 + Math.floor(rand() * 10)).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}:00.000Z`;

  const tasks: Task[] = [];
  const start = addDays(today, -HISTORY_DAYS);

  for (const r of ROUTINES) {
    const seriesId = nid();
    let due = start;
    if (r.freq !== "daily") while (weekday(due) !== r.wd) due = addDays(due, 1);
    let lastOwner = pick(r.owners);
    while (due < today) {
      const doneBy = pick(r.owners);
      const doneRate = r.freq === "daily" ? 0.7 : 0.9;
      if (rand() < doneRate) {
        const shift = rand() < 0.25 ? (rand() < 0.5 ? -1 : 1) : 0;
        let doneOn = addDays(due, shift);
        if (doneOn >= today) doneOn = addDays(today, -1);
        tasks.push(
          makeTask({
            id: nid(), title: r.title, system: r.system, kind: "recurring", frequency: r.freq, priority: r.pri,
            cognitiveLoad: r.load, estimateMinutes: r.min, dueDate: due, context: r.ctx ?? "",
            assigneeId: doneBy, assignmentReason: "Usually handles this routine.", status: "done",
            createdAt: stamp(addDays(due, -3)), createdBy: "m_maya", completedAt: stamp(doneOn), completedBy: doneBy, seriesId,
          }),
        );
        lastOwner = doneBy;
      }
      due = nextDue(due, r.freq);
    }
    tasks.push(
      makeTask({
        id: nid(), title: r.title, system: r.system, kind: "recurring", frequency: r.freq, priority: r.pri,
        cognitiveLoad: r.load, estimateMinutes: r.min, dueDate: due, context: r.ctx ?? "",
        assigneeId: lastOwner, assignmentReason: "Usually handles this routine.",
        createdAt: stamp(addDays(today, -1)), createdBy: "m_maya", seriesId,
      }),
    );
  }

  // Scattered one-off tasks, ~4 per week, skewed toward Maya so Rhythms has a fairness story to tell.
  for (let d = start; d < today; d = addDays(d, 1)) {
    if (rand() > 0.55) continue;
    const [title, system, min, load] = ONE_OFFS[Math.floor(rand() * ONE_OFFS.length)];
    const who = pick(ONE_OFF_OWNERS);
    tasks.push(
      makeTask({
        id: nid(), title, system, priority: rand() < 0.3 ? "high" : "medium", cognitiveLoad: load, estimateMinutes: min,
        dueDate: d, assigneeId: who, assignmentReason: "Had the most bandwidth that week.", status: "done",
        createdAt: stamp(addDays(d, -4)), createdBy: "m_maya", completedAt: stamp(d), completedBy: who,
      }),
    );
  }

  const open = (p: Partial<Task> & Pick<Task, "title" | "system">) =>
    tasks.push(makeTask({ id: nid(), createdBy: "m_maya", createdAt: stamp(addDays(today, -1)), ...p }));

  // Today's live items (matching the prototype screens).
  const grocery = tasks.find((t) => t.title === "Grocery shopping" && t.status === "open");
  if (grocery) Object.assign(grocery, { dueDate: today, dueLabel: "By 6 PM", assigneeId: "m_maya", context: "Whole Foods on Main St — list is on the fridge. Don't forget the oat milk!" });
  open({ title: "Pay electricity bill", system: "admin", priority: "high", estimateMinutes: 5, dueDate: today, dueLabel: "By end of day", cognitiveLoad: "light", assigneeId: "m_sam", assignmentReason: "Sam handles most bills.", context: "Autopay failed — card on file expired." });
  open({ title: "Schedule dentist", system: "health", priority: "low", estimateMinutes: 10, dueDate: addDays(today, 4), dueLabel: "This week", cognitiveLoad: "moderate", assigneeId: "m_maya", assignmentReason: "Maya usually books appointments.", context: "Dr. Patel's office — (555) 123-4567. Ask about cleaning + check on insurance coverage." });
  open({ title: "RSVP to Ava's birthday party", system: "relationships", priority: "medium", estimateMinutes: 5, dueDate: addDays(today, 1), dueLabel: "By tomorrow", assigneeId: "m_maya", assignmentReason: "Maya coordinates social plans.", context: "Party is Saturday 2–4 PM at the trampoline park." });
  open({ title: "Book summer camp", system: "calendar", priority: "high", estimateMinutes: 30, dueDate: addDays(today, 3), dueLabel: "Registration closes Friday", cognitiveLoad: "heavy", assigneeId: "m_sam", assignmentReason: "Maya is over capacity this week; Sam has room.", context: "Leo wants the robotics week (July 14–18). Early-bird discount ends Friday." });
  open({ title: "Replace HVAC filter", system: "maintenance", priority: "low", estimateMinutes: 15, dueDate: addDays(today, 5), dueLabel: "This week", assigneeId: "m_sam", assignmentReason: "Sam leads maintenance.", context: "20x25x1 filters are in the garage cabinet." });
  open({ title: "Return library books", system: "learning", priority: "medium", estimateMinutes: 15, dueDate: addDays(today, 2), assigneeId: "m_leo", assignmentReason: "Light task that fits Leo's school-night bandwidth.", context: "3 books on the shelf by the door." });
  open({ title: "Weekend at the lake?", system: "experiences", kind: "idea", estimateMinutes: 0, context: "Maybe in August once camp is done.", assigneeId: null });
  open({ title: "Start a family book club", system: "learning", kind: "idea", estimateMinutes: 0, context: "", assigneeId: null });

  return {
    id,
    name: "The Parker Household",
    timezone: tz,
    createdAt: new Date().toISOString(),
    members,
    tasks,
    signals: [],
  };
}
