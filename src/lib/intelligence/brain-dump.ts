import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { addDays, weekday } from "../dates";
import { SYSTEMS, SYSTEM_IDS } from "../systems";
import type { DumpResult, Household, Proposal, SystemId, Task } from "../types";
import { suggestAssignee } from "./assign";
import { buildContext, type HouseholdContext } from "./context";

export interface DumpInput {
  text: string;
  /** Photos and PDFs (base64). */
  images: { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf"; data: string }[];
  source: "text" | "photo" | "voice" | "siri" | "email";
  /** Answers to clarifying questions from a previous pass. */
  clarifications?: { question: string; answer: string }[];
  authorId: string;
}

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

const ItemSchema = z.object({
  kind: z.enum(["task", "recurring", "reminder", "idea"]),
  title: z.string(),
  system: z.enum(SYSTEM_IDS),
  priority: z.enum(["high", "medium", "low"]),
  cognitiveLoad: z.enum(["light", "moderate", "heavy"]),
  estimateMinutes: z.number().int(),
  dueDate: z.string().nullable(),
  dueLabel: z.string().nullable(),
  context: z.string(),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly"]).nullable(),
  suggestedAssigneeId: z.string().nullable(),
  assignmentReason: z.string(),
  clarifyingQuestion: z.string().nullable(),
  duplicateOfTaskId: z.string().nullable(),
  suggestedSteps: z.array(z.object({ title: z.string(), estimateMinutes: z.number().int() })),
});

const ResultSchema = z.object({
  summary: z.string(),
  fyiOnly: z.boolean(),
  items: z.array(ItemSchema),
});

const SYSTEM_PROMPT = `You are the quiet intelligence inside Better Together, a household app whose purpose is to lift the mental load of running a home. A family member has just "brain dumped" — typed, dictated, or photographed whatever was on their mind, without organizing it. Your job is to do the organizing for them so they don't have to.

Turn the dump into a short list of clear, actionable items, each mapped onto the household's operating framework:

${SYSTEMS.map((s) => `- ${s.id} (${s.name}, ${s.pillar === "engine" ? "The Engine" : s.pillar === "foundation" ? "The Foundation" : "The Good Life"}): ${s.definition}`).join("\n")}

How to interpret the dump:
- Understand what the person actually needs to happen. Split bundled thoughts into separate items; merge duplicates. Drop pure venting or filler that has no action, but keep anything that hints at a need.
- Classify each item's kind: "task" (one-off action), "recurring" (an ongoing responsibility that repeats — set frequency), "reminder" (a time-bound nudge with little effort, e.g. "remember picture day Thursday"), or "idea" (a someday/maybe with no commitment yet).
- Write titles as short verb-first actions a person can do ("Book Leo's dentist cleaning", not "dentist"). Put every useful detail from the dump (names, places, numbers, quantities, constraints) into context, in one or two friendly sentences. Never invent facts that aren't in the input.
- For photos (receipts, flyers, school notices, whiteboards, fridge notes, handwritten lists), read them carefully and extract the actionable items, dates, and details.
- Spoken input (source "voice" or "siri") arrives as one run-on transcript with little or no punctuation. Listen for every separate thing the person needs: "and", "also", "oh and", "plus", "then", or a change of subject usually starts a new item ("pay the electricity bill and Leo needs cleats oh and call the dentist" is three items). Never merge two different actions into one item. Ignore filler ("um", "ugh", "okay so").
- dueDate must be an ISO date (YYYY-MM-DD) resolved relative to today, or null if there's no timing signal. dueLabel is a short human phrase ("By 6 PM", "Before Friday", "This weekend") or null.
- priority: high = time-sensitive or consequential if missed (bills, deadlines, health, safety, other people waiting); medium = should happen soon; low = nice to do.
- cognitiveLoad: light = mindless/physical; moderate = some coordination or decisions; heavy = research, multi-step planning, money or emotionally loaded decisions.
- estimateMinutes: a realistic hands-on estimate (round to 5). Use the household's history for familiar tasks. Ideas are 0.

How to assign (suggestedAssigneeId must be one of the member ids provided, or null for ideas):
1. If the household has explicitly reassigned this kind of task before (learnedOverrides), follow that.
2. Recurring or familiar tasks go to the person who usually handles them (routines / systemShares) — unless they are clearly over capacity this week.
3. One-off tasks go to whoever has the most spare bandwidth (capacity minus open minutes) while still respecting preferences and personal notes (e.g. ages, schedules, constraints).
4. Fair does not mean 50/50: weigh each person's capacity. Avoid piling heavy cognitive-load work onto whoever already carries the most.
5. If the author says who should do it ("ask Sam to…", "I need to…"), honor that.
assignmentReason: one short, warm, transparent sentence explaining the pick in terms the family will find fair (e.g. "Sam has the most open time this week and usually handles bills.").

clarifyingQuestion: only when an item is genuinely ambiguous in a way that changes what should happen (who, when, or what exactly) — ask one short question. Otherwise null. Make your best guess for the fields regardless.

duplicateOfTaskId: the household's open tasks are listed in openTasks. If an item is clearly the same job as one of them (same action and object, even if worded differently — "renew registration" vs "DMV renewal for the car"), set this to that task's id; otherwise null. Don't flag tasks that are merely in the same area. Still fill in every other field normally.

suggestedSteps: only for an item that is genuinely big or fuzzy — roughly over an hour, heavy cognitive load, or vague verbs like "plan", "organize", "figure out", "sort out". Then propose 2–4 concrete, verb-first steps that together finish the job, each with a realistic estimateMinutes. Steps should be things different people could pick up (e.g. "Book the restaurant", "Invite family", "Order the cake"). For everything else, return an empty array. These are suggestions the family may accept or ignore.

fyiOnly: true only when the input is purely informational — nothing anyone needs to do (e.g. "practice moved to the east field", a newsletter with no deadlines). In that case return no items and say in the summary what's worth knowing. Otherwise false.

summary: one encouraging sentence (max ~20 words) reflecting back what you captured, e.g. "Got it — 4 things, mostly meals and logistics. Two are due before Friday." Keep the tone supportive and lightly playful, never clinical.`;

function contextBlock(h: Household, ctx: HouseholdContext, authorId: string) {
  const name = (id: string) => h.members.find((m) => m.id === id)?.name ?? id;
  const upcoming = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ctx.today, i);
    return `${d} (${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday(d)]})`;
  }).join(", ");
  return {
    today: `${ctx.today} (${ctx.weekdayName})`,
    nextSevenDays: upcoming,
    author: { id: authorId, name: name(authorId) },
    members: ctx.members.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      preferredSystems: m.preferredSystems,
      notes: m.notes || undefined,
      weeklyCapacityMinutes: m.capacityWeekMin,
      availableTodayMinutes: m.capacityTodayMin,
      openMinutesNext7Days: m.openMinutes,
      openTaskCount: m.openCount,
      percentOfCapacityCommitted: Math.round(m.loadRatio * 100),
      minutesCompletedLast28Days: m.doneMinutes28d,
    })),
    systemShares: Object.fromEntries(
      Object.entries(ctx.systemShares).map(([sys, row]) => [sys, Object.fromEntries(Object.entries(row!).map(([id, s]) => [name(id), s]))]),
    ),
    routines: ctx.routines.slice(0, 25).map((r) => ({
      title: r.title,
      system: r.system,
      frequency: r.frequency,
      usualOwner: `${name(r.usualOwnerId)} (${r.usualOwnerId})`,
      avgMinutes: r.avgMinutes,
    })),
    learnedOverrides: Object.fromEntries(Object.entries(ctx.learnedOverrides).map(([k, id]) => [k, `${name(id)} (${id})`])),
    openTasks: openTasksFor(h).map((t) => ({ id: t.id, title: t.title, assignee: t.assigneeId ? name(t.assigneeId) : null, due: t.dueDate })),
  };
}

/** Open work the household already has — what new items get checked against for duplicates. */
function openTasksFor(h: Household) {
  return h.tasks
    .filter((t) => t.status === "open")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 120);
}

const STOP = new Set(["the", "a", "an", "to", "for", "and", "of", "my", "our", "on", "at", "in", "with", "get", "do"]);
const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));

/** Conservative word-overlap match, used when Claude isn't available. */
function findDuplicate(h: Household, title: string): Task | undefined {
  const a = words(title);
  if (a.size === 0) return undefined;
  let best: { t: Task; score: number } | undefined;
  for (const t of openTasksFor(h)) {
    const b = words(t.title);
    const overlap = [...a].filter((w) => b.has(w)).length;
    const score = overlap / Math.max(a.size, b.size);
    if (overlap >= 2 && score >= 0.6 && (!best || score > best.score)) best = { t, score };
  }
  return best?.t;
}

function duplicateInfo(h: Household, t: Task | undefined): Proposal["duplicateOf"] {
  if (!t) return null;
  return { taskId: t.id, title: t.title, assigneeName: h.members.find((m) => m.id === t.assigneeId)?.name ?? null };
}

function cleanSteps(steps: { title: string; estimateMinutes: number }[] | undefined) {
  const out = (steps ?? [])
    .map((s) => ({ title: s.title.trim(), estimateMinutes: Math.min(240, Math.max(5, Math.round((s.estimateMinutes || 15) / 5) * 5)) }))
    .filter((s) => s.title);
  return out.length >= 2 ? out.slice(0, 4) : [];
}

let client: Anthropic | null = null;
export function claudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/**
 * A key pasted with stray characters (an arrow, a space, quotes) makes every request fail
 * with a cryptic header error. Returns a plain explanation when the key looks malformed.
 */
export function claudeKeyProblem(): string | null {
  const key = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN;
  if (!key) return null;
  if (/[^\x21-\x7E]/.test(key) || /["']/.test(key)) {
    return "The Claude API key saved in Vercel has extra characters in it (like a space, arrow, or quote). Re-paste just the key into ANTHROPIC_API_KEY and redeploy.";
  }
  return null;
}

/** Turns API failures into messages a family member can act on. */
function friendlyClaudeError(e: unknown): Error {
  if (e instanceof Anthropic.AuthenticationError) return new Error("Claude didn't accept the API key. Check ANTHROPIC_API_KEY in Vercel and redeploy.");
  if (e instanceof Anthropic.PermissionDeniedError) return new Error("This Claude API key isn't allowed to use that model. Check the key's workspace settings.");
  if (e instanceof Anthropic.RateLimitError) return new Error("Claude is busy right now — give it a minute and try again.");
  if (e instanceof Anthropic.APIConnectionError) return new Error("Couldn't reach Claude just now. Check your connection and try again.");
  if (e instanceof Anthropic.APIError) return new Error(`Claude had trouble with that one (${e.status ?? "error"}). Please try again.`);
  return e instanceof Error ? e : new Error("Something went wrong talking to Claude.");
}

/** Shared guard + error mapping for every Claude call. */
async function callClaude<T>(fn: (c: Anthropic) => Promise<T>): Promise<T> {
  const problem = claudeKeyProblem();
  if (problem) throw new Error(problem);
  client ??= new Anthropic();
  try {
    return await fn(client);
  } catch (e) {
    console.error("Claude request failed:", e);
    throw friendlyClaudeError(e);
  }
}

export async function interpretDump(h: Household, input: DumpInput): Promise<DumpResult> {
  const ctx = buildContext(h);
  if (!claudeConfigured()) return offlineInterpret(h, ctx, input);

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...input.images.map((f): Anthropic.Beta.BetaContentBlockParam =>
      f.mediaType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } }
        : { type: "image", source: { type: "base64", media_type: f.mediaType, data: f.data } },
    ),
    {
      type: "text",
      text: [
        `<household_context>\n${JSON.stringify(contextBlock(h, ctx, input.authorId), null, 1)}\n</household_context>`,
        `<brain_dump source="${input.source}">\n${input.text.trim() || (input.images.length ? "(See the attached photo or document.)" : "")}\n</brain_dump>`,
        input.clarifications?.length
          ? `<clarifications>\n${input.clarifications.map((c) => `Q: ${c.question}\nA: ${c.answer}`).join("\n\n")}\n</clarifications>\nUse these answers to finalize the items; don't re-ask them.`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  const response = await callClaude((c) => c.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    output_config: { effort: "low", format: betaZodOutputFormat(ResultSchema) },
    messages: [{ role: "user", content }],
  }));

  if (response.stop_reason === "refusal") {
    throw new Error("That one couldn't be processed. Try rephrasing it?");
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("The assistant's answer couldn't be read. Please try again.");

  const memberIds = new Set(h.members.map((m) => m.id));
  const openById = new Map(openTasksFor(h).map((t) => [t.id, t]));
  const proposals = parsed.items.map((it, i): Proposal => {
    const p: Proposal = {
      tempId: `p${i}_${Date.now().toString(36)}`,
      kind: it.kind,
      title: it.title.trim(),
      system: it.system,
      priority: it.priority,
      cognitiveLoad: it.cognitiveLoad,
      estimateMinutes: it.kind === "idea" ? 0 : Math.min(600, Math.max(5, Math.round(it.estimateMinutes / 5) * 5)),
      dueDate: it.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(it.dueDate) ? it.dueDate : null,
      dueLabel: it.dueLabel,
      context: it.context,
      frequency: it.kind === "recurring" ? (it.frequency ?? "weekly") : null,
      suggestedAssigneeId: it.suggestedAssigneeId && memberIds.has(it.suggestedAssigneeId) ? it.suggestedAssigneeId : null,
      assignmentReason: it.assignmentReason,
      clarifyingQuestion: it.clarifyingQuestion,
      duplicateOf: duplicateInfo(h, it.duplicateOfTaskId ? openById.get(it.duplicateOfTaskId) : undefined),
      suggestedSteps: it.kind === "idea" ? [] : cleanSteps(it.suggestedSteps),
    };
    if (!p.suggestedAssigneeId && p.kind !== "idea") {
      const pick = suggestAssignee(ctx, p);
      p.suggestedAssigneeId = pick.memberId;
      p.assignmentReason = pick.reason;
    }
    return p;
  });

  return { summary: parsed.summary, proposals, engine: "claude", fyiOnly: parsed.fyiOnly && proposals.length === 0 };
}

// ---------------------------------------------------------------------------------
// Offline engine: keyword heuristics so the app is fully usable without an API key.
// ---------------------------------------------------------------------------------

const KEYWORDS: Array<[SystemId, RegExp]> = [
  ["meals", /\b(grocer|groceries|fridge|dinner|lunch|breakfast|meal|cook|recipe|milk|eggs|bread|food|snack|bake)\w*/i],
  ["laundry", /\b(laundry|wash|fold|clothes|sheets|towels|linens|dry ?clean|iron)\w*/i],
  ["calendar", /\b(pick ?up|drop ?off|carpool|schedule|appointment|practice|ride|drive|book|rsvp|camp|reservation|flight)\w*/i],
  ["maintenance", /\b(fix|repair|clean|trash|recycl|filter|leak|lawn|mow|car|oil|tire|plumb|paint|vacuum|dishes|gutter|bulb|batter)\w*/i],
  ["admin", /\b(bill|pay|renew|registration|insurance|tax|form|paperwork|permission|sign|passport|license|mail|return)\w*/i],
  ["budget", /\b(budget|save|savings|spend|invest|529|retire|subscription|money|bank|refund)\w*/i],
  ["organization", /\b(declutter|organi[sz]e|donate|closet|garage|pantry|storage|sort|tidy)\w*/i],
  ["alignment", /\b(talk|discuss|family meeting|decide|plan(?:ning)? the week|chore chart|rules|screen time)\w*/i],
  ["health", /\b(doctor|dentist|pediatric|prescription|medicine|workout|gym|walk|therapy|vaccin|sleep|health|vet)\w*/i],
  ["experiences", /\b(vacation|hike|outing|museum|beach|zoo|park|adventure|fun|long weekend|getaway|concert|trip)\w*/i],
  ["learning", /\b(homework|study|library|piano|lesson|class|tutor|read|school project|practice piano|learn)\w*/i],
  ["relationships", /\b(birthday|gift|call (?:mom|dad|grandma|grandpa)|friend|party|thank you|anniversary|date night|visit)\w*/i],
];

const DEFAULT_MINUTES: Record<SystemId, number> = {
  meals: 45, laundry: 40, calendar: 15, maintenance: 30, admin: 15, budget: 30,
  organization: 45, alignment: 20, health: 15, experiences: 60, learning: 30, relationships: 20,
};

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function offlineInterpret(h: Household, ctx: HouseholdContext, input: DumpInput): DumpResult {
  const raw = [input.text, ...(input.clarifications ?? []).map((c) => c.answer)].join("\n");
  const fragments = raw
    .split(/\n|;|•|(?:^|\s)[-*]\s|[.!?]\s+/)
    .flatMap((s) => s.split(/,\s*(?:and\s+)?|\s+and\s+(?=(?:we|i|also|then|need|should|gotta|have|remember|the|my|our|pay|book|schedule|call|buy|pick|fix|order|make|clean|return|renew|sign|email|text|plan|get)\b)|\s+(?:and also|also)\s+/i))
    .map((s) => s?.trim().replace(/^(and|also|then|oh|um|so|plus)\s+/i, "").replace(/[.!]+$/, ""))
    .filter((s): s is string => Boolean(s && s.split(/\s+/).length >= 2));

  const proposals: Proposal[] = fragments.map((frag, i) => {
    const lower = frag.toLowerCase();
    const system = KEYWORDS.find(([, re]) => re.test(frag))?.[0] ?? "admin";
    const isIdea = /\b(maybe|idea|someday|would be (nice|fun)|what if|we should (try|think))\b/.test(lower);
    const freqMatch = lower.match(/\b(every day|daily|every week|weekly|every (?:mon|tues|wednes|thurs|fri|satur|sun)day|biweekly|every other week|monthly|every month)\b/);
    const frequency = freqMatch
      ? /day|daily/.test(freqMatch[0]) && !/every \w+day/.test(freqMatch[0]) ? "daily"
        : /other|biweekly/.test(freqMatch[0]) ? "biweekly"
        : /month/.test(freqMatch[0]) ? "monthly" : "weekly"
      : null;
    const kind = isIdea ? "idea" : frequency ? "recurring" : /\bremind|remember|don't forget\b/.test(lower) ? "reminder" : "task";

    let dueDate: string | null = null;
    let dueLabel: string | null = null;
    if (/\b(today|tonight|asap|now)\b/.test(lower)) [dueDate, dueLabel] = [ctx.today, "Today"];
    else if (/\btomorrow\b/.test(lower)) [dueDate, dueLabel] = [addDays(ctx.today, 1), "Tomorrow"];
    else if (/\bthis weekend\b/.test(lower)) {
      const wd = weekday(ctx.today);
      [dueDate, dueLabel] = [addDays(ctx.today, (6 - wd + 7) % 7), "This weekend"];
    } else {
      const d = DAYS.findIndex((day) => lower.includes(day));
      if (d >= 0) {
        const diff = (d - weekday(ctx.today) + 7) % 7 || 7;
        [dueDate, dueLabel] = [addDays(ctx.today, diff), `By ${DAYS[d][0].toUpperCase()}${DAYS[d].slice(1)}`];
      } else if (/\bthis week\b/.test(lower)) [dueDate, dueLabel] = [addDays(ctx.today, 4), "This week"];
    }

    const urgent = /\b(urgent|asap|overdue|due|deadline|important|today|tonight|must)\b/.test(lower);
    const priority = urgent ? "high" : dueDate && dueDate <= addDays(ctx.today, 2) ? "medium" : "low";
    const cognitiveLoad = /\b(research|plan|figure out|decide|compare|budget|taxes|insurance|camp|organi[sz]e)\b/.test(lower) ? "heavy" : /\b(book|schedule|call|coordinate|rsvp)\b/.test(lower) ? "moderate" : "light";
    const title = frag.replace(/^(i|we) (need|have|gotta|should|must) to\s+/i, "").replace(/^(need to|have to|gotta|remember to|don't forget to)\s+/i, "");
    const p: Proposal = {
      tempId: `p${i}_${Date.now().toString(36)}`,
      kind,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      system,
      priority,
      cognitiveLoad,
      estimateMinutes: kind === "idea" ? 0 : kind === "reminder" ? 5 : DEFAULT_MINUTES[system],
      dueDate,
      dueLabel,
      context: "",
      frequency,
      suggestedAssigneeId: null,
      assignmentReason: "",
      clarifyingQuestion: null,
      duplicateOf: kind === "idea" ? null : duplicateInfo(h, findDuplicate(h, title)),
      suggestedSteps: [],
    };
    const named = h.members.find((m) => new RegExp(`\\b${m.name}\\b`, "i").test(frag));
    if (named && kind !== "idea") {
      p.suggestedAssigneeId = named.id;
      p.assignmentReason = `You mentioned ${named.name}.`;
    } else if (/^(i|i'll|i need|my)\b/i.test(frag) && kind !== "idea") {
      p.suggestedAssigneeId = input.authorId;
      p.assignmentReason = "Sounded like you wanted to take this one.";
    } else {
      const pick = suggestAssignee(ctx, p);
      p.suggestedAssigneeId = pick.memberId;
      p.assignmentReason = pick.reason;
    }
    return p;
  });

  if (input.images.length && proposals.length === 0) {
    proposals.push({
      tempId: `p_img_${Date.now().toString(36)}`, kind: "task", title: "Go through what you uploaded", system: "admin",
      priority: "medium", cognitiveLoad: "light", estimateMinutes: 10, dueDate: null, dueLabel: null,
      context: "Reading photos and PDFs needs the Claude connection (set ANTHROPIC_API_KEY).", frequency: null,
      suggestedAssigneeId: input.authorId, assignmentReason: "You uploaded it.", clarifyingQuestion: null,
    });
  }

  const n = proposals.length;
  return {
    summary: n ? `Captured ${n} thing${n === 1 ? "" : "s"} — take a quick look and send them off.` : "Hmm, I couldn't find anything actionable in that one.",
    proposals,
    engine: "offline",
  };
}

// ---------------------------------------------------------------------------------
// Breaking down a task that keeps slipping (My Day nudge).
// ---------------------------------------------------------------------------------

const StepsSchema = z.object({ steps: z.array(z.object({ title: z.string(), estimateMinutes: z.number().int() })) });

/** Suggests 2–4 smaller steps for an existing task. Returns [] when Claude isn't configured. */
export async function suggestStepsFor(h: Household, task: Task): Promise<{ title: string; estimateMinutes: number }[]> {
  if (!claudeConfigured()) return [];
  const response = await callClaude((c) => c.beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system:
      "You help a family break a household task that keeps getting put off into 2–4 small, concrete, verb-first steps that together finish the job. Each step should be doable in one sitting and could be picked up by a different family member. Give each a realistic estimateMinutes (round to 5). Use only details present in the task; don't invent names, places, or dates.",
    output_config: { effort: "low", format: betaZodOutputFormat(StepsSchema) },
    messages: [
      {
        role: "user",
        content: `Task: ${task.title}\nArea: ${SYSTEMS.find((s) => s.id === task.system)?.name}\nEstimated: ${task.estimateMinutes} minutes\nNotes: ${task.context || "(none)"}\nSkipped ${task.skipCount} times.`,
      },
    ],
  }));
  if (response.stop_reason === "refusal" || !response.parsed_output) return [];
  return cleanSteps(response.parsed_output.steps);
}
