import { NextResponse } from "next/server";
import { commitItems } from "@/lib/commit";
import { getHousehold, newId, resolveKey, updateHousehold } from "@/lib/db";
import { claudeConfigured, claudeKeyProblem, interpretDump } from "@/lib/intelligence/brain-dump";
import type { DumpResult, Household, Proposal } from "@/lib/types";

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

const DRAFT_TTL_MS = 15 * 60 * 1000;

/** "one, pay the bill; two, …" — numbered so a listener can follow along. */
function readBack(result: DumpResult) {
  const words = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const items = result.proposals;
  if (items.length === 1) return `I heard one thing: ${items[0].title}. Should I add it?`;
  const shown = items.slice(0, 10).map((p, i) => `${words[i]}, ${p.title}`);
  return `I heard ${items.length} things: ${list(shown)}. Should I add them?`;
}

/**
 * Hands-free capture (Siri Shortcut), in two steps. Authenticated with a personal key:
 *   1. POST {"text": "…"}      → Claude sorts it; responds {message} for Siri to read back
 *                                 ("I heard 3 things: one, …"). Nothing is added yet.
 *   2. POST {"confirm": true}  → adds that latest dictation: clear items go straight to the
 *                                 household's to-dos; unclear/duplicate/big ones wait in To review.
 *   {"test": true} only checks the key.
 */
export async function POST(req: Request) {
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const ref = key ? await resolveKey(key) : null;
  if (!ref) return NextResponse.json({ message: "Better Together didn't recognize that key. Make a new one in the app." }, { status: 401 });

  const type = req.headers.get("content-type") ?? "";
  let text = "";
  let test = false;
  let confirm = false;
  if (type.includes("application/json")) {
    const body = await req.json().catch(() => null);
    text = typeof body?.text === "string" ? body.text : "";
    test = body?.test === true;
    confirm = body?.confirm === true;
  } else {
    text = await req.text();
  }
  if (test) return NextResponse.json({ message: "Your key works. You're all set." });

  const household = await getHousehold(ref.householdId);
  if (!household) return NextResponse.json({ message: "Better Together couldn't find your household." }, { status: 404 });

  if (confirm) return confirmLatest(household, ref.memberId);

  text = text.trim().slice(0, 4000);
  if (!text) return NextResponse.json({ message: "I didn't catch anything — try again." }, { status: 400 });
  if ((household.inbox ?? []).filter((i) => i.status === "new").length >= MAX_PENDING) {
    return NextResponse.json({ message: "Your Brain Dump inbox is full — review a few items in the app first." }, { status: 429 });
  }

  // Sort it now so the read-back reflects how it was understood (and split).
  let result: DumpResult | null = null;
  if (claudeConfigured() && !claudeKeyProblem()) {
    try {
      result = await interpretDump(household, { text, images: [], source: "siri", authorId: ref.memberId });
    } catch (e) {
      console.error("Siri interpret failed; will hold for review", e);
    }
  }

  await updateHousehold(household.id, (h) => {
    const cutoff = Date.now() - DRAFT_TTL_MS;
    // One pending dictation per person: a new one replaces any that was never confirmed.
    h.siriDrafts = (h.siriDrafts ?? []).filter((d) => d.memberId !== ref.memberId && new Date(d.createdAt).getTime() > cutoff);
    h.siriDrafts.push({ id: newId("sd_"), memberId: ref.memberId, text, createdAt: new Date().toISOString(), result });
  });

  let message: string;
  if (!result) message = `I heard: ${text}. Should I save it to Brain Dump for review?`;
  else if (result.fyiOnly || result.proposals.length === 0) message = `That sounds like an FYI: ${result.summary} Should I share it with the family?`;
  else message = readBack(result);
  return NextResponse.json({ message, count: result?.proposals.length ?? 0 });
}

async function confirmLatest(household: Household, memberId: string) {
  const cutoff = Date.now() - DRAFT_TTL_MS;
  const draft = (household.siriDrafts ?? [])
    .filter((d) => d.memberId === memberId && new Date(d.createdAt).getTime() > cutoff)
    .at(-1);
  if (!draft) return NextResponse.json({ message: "I don't have anything waiting to add — it may have timed out. Try saying it again?" }, { status: 410 });

  const base = { source: "siri" as const, text: draft.text, fromMemberId: memberId, createdAt: draft.createdAt };
  const result = draft.result;
  let message = "";
  let added = 0;
  let heldCount = 0;

  await updateHousehold(household.id, (h) => {
    h.siriDrafts = (h.siriDrafts ?? []).filter((d) => d.id !== draft.id);
    const inbox = (h.inbox ??= []);
    const speaker = h.members.find((m) => m.id === memberId)!;

    // Without Claude there's no reliable way to sort it, so a person reviews it in the app.
    if (!result) {
      inbox.push({ id: newId("in_"), ...base, status: "new" });
      message = "Saved it in Brain Dump. Someone will look it over.";
      return;
    }
    if (result.fyiOnly || result.proposals.length === 0) {
      inbox.push({ id: newId("in_"), ...base, status: "new", fyi: true, summary: result.summary });
      message = "Shared. It's in Brain Dump for the family to see.";
      return;
    }

    const clear = result.proposals.filter((p) => !needsALook(p));
    const held = result.proposals.filter(needsALook);
    added = clear.length;
    heldCount = held.length;
    if (clear.length) {
      commitItems(h, clear.map((p) => ({ ...p, assigneeId: p.suggestedAssigneeId })), speaker, () => newId("t_"));
      // A history record so the household can see what came in by voice and who said it.
      inbox.push({ id: newId("in_"), ...base, status: "reviewed", outcome: "tasks", taskCount: clear.length, reviewedBy: speaker.id, reviewedAt: new Date().toISOString(), auto: true });
    }
    if (held.length) {
      inbox.push({ id: newId("in_"), ...base, status: "new", proposals: held, summary: `${held.length === 1 ? "This one needs" : "These need"} a closer look before anyone takes them on.` });
    }
    const reviewed = inbox.filter((i) => i.status === "reviewed");
    if (reviewed.length > 30) h.inbox = inbox.filter((i) => i.status === "new" || reviewed.slice(-30).includes(i));
    message = speech(h, memberId, clear, held.length, null);
  });

  return NextResponse.json({ message, added, held: heldCount });
}
