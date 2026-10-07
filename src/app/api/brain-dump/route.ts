import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, route } from "@/lib/http";
import { interpretDump } from "@/lib/intelligence/brain-dump";

export const maxDuration = 60;

const Body = z.object({
  text: z.string().max(8000).default(""),
  source: z.enum(["text", "photo", "voice"]).default("text"),
  images: z
    .array(z.object({ mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]), data: z.string().max(4_500_000) }))
    .max(3)
    .default([]),
  clarifications: z.array(z.object({ question: z.string(), answer: z.string() })).max(10).optional(),
});

export const POST = route(Body, async ({ household, me }, body) => {
  if (!body.text.trim() && body.images.length === 0) return fail(400, "Tell me what's on your mind first.");
  const result = await interpretDump(household, { ...body, authorId: me.id });
  return NextResponse.json(result);
});
