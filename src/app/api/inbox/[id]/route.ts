import { NextResponse } from "next/server";
import { z } from "zod";
import { updateHousehold } from "@/lib/db";
import { fail, route } from "@/lib/http";
import { interpretDump } from "@/lib/intelligence/brain-dump";

const Body = z.object({ action: z.enum(["interpret", "ack"]) });
const idFrom = (req: Request) => decodeURIComponent(new URL(req.url).pathname.split("/").pop() ?? "");

/**
 * interpret: run the stored text through the same Claude interpretation as a typed dump.
 * ack: mark as reviewed — "Got it" for FYI items (anyone in the household can review).
 */
export const PATCH = route(Body, async ({ household, me }, { action }, req) => {
  const id = idFrom(req);
  const item = household.inbox?.find((i) => i.id === id);
  if (!item) return fail(404, "That item is no longer in the inbox.");

  if (action === "interpret") {
    const result = await interpretDump(household, {
      text: item.text,
      images: [],
      source: item.source,
      authorId: item.fromMemberId ?? me.id,
    });
    return NextResponse.json(result);
  }

  await updateHousehold(household.id, (h) => {
    const it = h.inbox?.find((i) => i.id === id);
    if (it && it.status === "new") Object.assign(it, { status: "reviewed", outcome: "fyi", reviewedBy: me.id, reviewedAt: new Date().toISOString() });
  });
  return NextResponse.json({ ok: true });
});
