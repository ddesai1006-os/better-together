import { NextResponse } from "next/server";
import { commitItems } from "@/lib/commit";
import { getHousehold, newId, resolveKey, updateHousehold } from "@/lib/db";
import { claudeConfigured, claudeKeyProblem, interpretDump } from "@/lib/intelligence/brain-dump";
import type { DumpResult, Household, InboxItem, Proposal } from "@/lib/types";

export const maxDuration = 60;

const MAX_PENDING = 100;

/** Confusing or complex items wait for a person; everything else can go straight to the list. */
function needsALook(p: Proposal) {
  return Boolean(p.clarifyingQuestion || p.duplicateOf || p.suggestedSteps?.length);
}

function list(items: string[]) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join("; ")}; and ${items.at(-1)}`;
}

/** What Siri says back. Short, plain, and specific about who got what. */
function speech(h: Household, speakerId: string, added: Proposal[], held: number, fyi: string | null) {
  if (fyi) return `Noted: ${fyi} Nothing to do, so I left it in Brain Dump for the family to see.`;
  const name = (id: string | null) => (id === speakerId ? "you" : (h.members.find((m) => m.id === id)?.name ?? "the household"));
  const parts: string[] = [];
  if (added.length) {
    const shown = added.slice(0, 3).map((p) => (p.kind === "idea" ? `${p.title}, saved as an idea` : `${p.title}, for ${name(p.suggestedAssigneeId)}`));
    const more = added.length > 3 ? `, plus ${added.length - 3} more` : "";
    parts.push(`Added ${added.length} to-do${added.length === 1 ? "" : "s"}: ${list(shown)}${more}.`);
  }
  if (held) parts.push(`${held === 1 ? "One needs" : `${held} need`} a closer look — ${held === 1 ? "it's" : "they're"} waiting in Brain Dump.`);
  return parts.join(" ") || "I didn't catch anything to add. Try again?";
}

/**
 * Hands-free capture (Siri Shortcut). Authenticated with a personal key, not a cookie:
 *   POST /api/inbox   Authorization: Bearer bt_…   {"text": "…"}  (or a plain-text body)
 * Clear items are added straight to the household's to-dos with Claude's suggested owner;
 * confusing or complex ones wait in Brain Dump's To review. Responds with {message} for Siri to speak.
 * {"test": true} only checks the key.
 */
export async function POST(req: Request) {
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const ref = key ? await resolveKey(key) : null;
  if (!ref) return NextResponse.json({ message: "Better Together didn't recognize that key. Make a new one in the app." }, { status: 401 });

  const type = req.headers.get("content-type") ?? "";
  let text = "";
  let test = false;
  if (type.includes("application/json")) {
    const body = await req.json().catch(() => null);
    text = typeof body?.text === "string" ? body.text : "";
    test = body?.test === true;
  } else {
    text = await req.text();
  }
  if (test) return NextResponse.json({ message: "Your key works. You're all set." });
  text = text.trim().slice(0, 4000);
  if (!text) return NextResponse.json({ message: "I didn't catch anything — try again." }, { status: 400 });

  const household = await getHousehold(ref.householdId);
  if (!household) return NextResponse.json({ message: "Better Together couldn't find your household." }, { status: 404 });
  if ((household.inbox ?? []).filter((i) => i.status === "new").length >= MAX_PENDING) {
    return NextResponse.json({ message: "Your Brain Dump inbox is full — review a few items in the app first." }, { status: 429 });
  }

  const base = { source: "siri" as const, text, fromMemberId: ref.memberId, createdAt: new Date().toISOString() };
  const saveForReview = async (extra: Partial<InboxItem> = {}) =>
    updateHousehold(household.id, (h) => {
      (h.inbox ??= []).push({ id: newId("in_"), ...base, status: "new", ...extra });
    });

  // Without Claude there's no reliable way to sort it, so a person reviews everything.
  if (!claudeConfigured() || claudeKeyProblem()) {
    await saveForReview();
    return NextResponse.json({ message: "Saved it in Brain Dump. Someone will look it over." });
  }

  let result: DumpResult;
  try {
    result = await interpretDump(household, { text, images: [], source: "siri", authorId: ref.memberId });
  } catch (e) {
    console.error("Siri interpret failed; holding for review", e);
    await saveForReview();
    return NextResponse.json({ message: "Saved it in Brain Dump. Someone will look it over." });
  }

  if (result.fyiOnly || result.proposals.length === 0) {
    await saveForReview({ fyi: true, summary: result.summary });
    return NextResponse.json({ message: speech(household, ref.memberId, [], 0, result.summary) });
  }

  const clear = result.proposals.filter((p) => !needsALook(p));
  const held = result.proposals.filter(needsALook);

  await updateHousehold(household.id, (h) => {
    const speaker = h.members.find((m) => m.id === ref.memberId)!;
    const inbox = (h.inbox ??= []);
    if (clear.length) {
      commitItems(h, clear.map((p) => ({ ...p, assigneeId: p.suggestedAssigneeId })), speaker, () => newId("t_"));
      // A history record so the household can see what came in by voice and who said it.
      inbox.push({ id: newId("in_"), ...base, status: "reviewed", outcome: "tasks", taskCount: clear.length, reviewedBy: speaker.id, reviewedAt: base.createdAt, auto: true });
    }
    if (held.length) {
      inbox.push({ id: newId("in_"), ...base, status: "new", proposals: held, summary: `${held.length === 1 ? "This one needs" : "These need"} a closer look before anyone takes them on.` });
    }
    const reviewed = inbox.filter((i) => i.status === "reviewed");
    if (reviewed.length > 30) h.inbox = inbox.filter((i) => i.status === "new" || reviewed.slice(-30).includes(i));
  });

  return NextResponse.json({ message: speech(household, ref.memberId, clear, held.length, null), added: clear.length, held: held.length });
}
