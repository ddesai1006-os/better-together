import { systemOf } from "../systems";
import { titleKey } from "../tasks";
import type { CognitiveLoad, ItemKind, SystemId } from "../types";
import type { HouseholdContext } from "./context";

interface Candidate {
  title: string;
  system: SystemId;
  kind: ItemKind;
  cognitiveLoad: CognitiveLoad;
  estimateMinutes: number;
}

export interface AssignmentPick {
  memberId: string | null;
  reason: string;
}

/**
 * Deterministic assignment used as the offline engine and as a safety net when the
 * model's suggestion is missing or invalid. Mirrors the rules given to Claude:
 * learned overrides → routine owner (if they have room) → best blend of preference,
 * history, and spare bandwidth. "Fair" means proportional to capacity, not 50/50.
 */
export function suggestAssignee(ctx: HouseholdContext, c: Candidate): AssignmentPick {
  if (c.kind === "idea" || ctx.members.length === 0) return { memberId: null, reason: "Ideas stay with the household until someone picks them up." };
  const key = titleKey(c.title);
  const byId = new Map(ctx.members.map((m) => [m.id, m]));

  const learned = ctx.learnedOverrides[key];
  if (learned && byId.has(learned)) {
    return { memberId: learned, reason: `You've given "${c.title}" to ${byId.get(learned)!.name} before.` };
  }

  const routine = ctx.routines.find((r) => r.key === key);
  if (routine && byId.has(routine.usualOwnerId)) {
    const owner = byId.get(routine.usualOwnerId)!;
    if (owner.loadRatio < 1.1) {
      return { memberId: owner.id, reason: `${owner.name} usually handles this (${Math.round(routine.ownerShare * 100)}% of the time).` };
    }
  }

  const shares = ctx.systemShares[c.system] ?? {};
  // Spare minutes relative to the roomiest member: bandwidth in absolute terms, so a
  // light schedule with nothing on it doesn't out-rank someone with hours free.
  const spare = (m: (typeof ctx.members)[number]) => m.capacityWeekMin - m.openMinutes;
  const maxSpare = Math.max(1, ...ctx.members.map(spare));
  let best: { id: string; score: number; why: string } | null = null;
  for (const m of ctx.members) {
    const pref = m.preferredSystems.includes(c.system) ? 1 : 0;
    const hist = shares[m.id] ?? 0;
    const room = m.loadRatio > 1 ? -0.5 : spare(m) / maxSpare;
    const tooBig = c.estimateMinutes > m.capacityWeekMin * 0.25 ? 1 : 0;
    const heavyOnLight = c.cognitiveLoad === "heavy" && m.capacityWeekMin < 300 ? 1 : 0;
    const score = pref * 2 + hist * 2.5 + room * 3 - tooBig * 1.5 - heavyOnLight * 1.5;
    const sys = systemOf(c.system).short.toLowerCase();
    // Explain the pick by whichever factor contributed most.
    const why = [
      { v: room * 3, t: room >= 0.99 ? `${m.name} has the most free time this week.` : `${m.name} has time for it this week.` },
      { v: pref * 2, t: `${m.name} likes owning ${sys} and has room for it.` },
      { v: hist * 2.5, t: `${m.name} usually takes the lead on ${sys}.` },
    ].sort((a, b) => b.v - a.v)[0].t;
    if (!best || score > best.score) best = { id: m.id, score, why };
  }
  return { memberId: best!.id, reason: best!.why };
}
