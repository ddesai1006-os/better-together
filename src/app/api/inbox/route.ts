import { NextResponse } from "next/server";
import { newId, resolveKey, updateHousehold } from "@/lib/db";

const MAX_NEW = 100;

/**
 * Hands-free capture (Siri Shortcut). Authenticated with a personal key, not a cookie:
 *   POST /api/inbox   Authorization: Bearer bt_…   {"text": "…"}  (or a plain-text body)
 * Items wait in the To review inbox; nothing is assigned until a person reviews it.
 */
export async function POST(req: Request) {
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const ref = key ? await resolveKey(key) : null;
  if (!ref) return NextResponse.json({ message: "Better Together didn't recognize that key. Make a new one in the app." }, { status: 401 });

  const type = req.headers.get("content-type") ?? "";
  let text = "";
  if (type.includes("application/json")) {
    const body = await req.json().catch(() => null);
    text = typeof body?.text === "string" ? body.text : "";
  } else {
    text = await req.text();
  }
  text = text.trim().slice(0, 4000);
  if (!text) return NextResponse.json({ message: "I didn't catch anything — try again." }, { status: 400 });

  const ok = await updateHousehold(ref.householdId, (h) => {
    const inbox = (h.inbox ??= []);
    if (inbox.filter((i) => i.status === "new").length >= MAX_NEW) return false;
    inbox.push({ id: newId("in_"), source: "siri", text, fromMemberId: ref.memberId, createdAt: new Date().toISOString(), status: "new" });
    // Keep reviewed history short.
    const reviewed = inbox.filter((i) => i.status === "reviewed");
    if (reviewed.length > 30) h.inbox = inbox.filter((i) => i.status === "new" || reviewed.slice(-30).includes(i));
    return true;
  });
  if (!ok) return NextResponse.json({ message: "Your inbox is full — review a few items in the app first." }, { status: 429 });
  return NextResponse.json({ message: "Got it — it's in Better Together, waiting for review." });
}
