import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { currentViewer, type Viewer } from "./auth";

export const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/** Wraps a route handler with auth + JSON body validation. */
export function route<S extends z.ZodType>(
  schema: S | null,
  handler: (viewer: Viewer, body: z.infer<S>, req: Request) => Promise<Response>,
  opts: { admin?: boolean } = {},
) {
  return async (req: Request) => {
    const viewer = await currentViewer();
    if (!viewer) return fail(401, "Please sign in again.");
    if (opts.admin && !viewer.isAdmin) return fail(403, "Only the household admin can do that.");
    let body: unknown = undefined;
    if (schema) {
      const parsed = schema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        // Friendly messages pass through; generic ones name the field to make problems findable.
        const msg = issue?.message.startsWith("Invalid") && issue.path.length ? `${issue.message} (${issue.path.join(".")})` : issue?.message;
        return fail(400, msg ?? "Invalid request");
      }
      body = parsed.data;
    }
    try {
      return await handler(viewer, body as z.infer<S>, req);
    } catch (e) {
      console.error(e);
      return fail(500, e instanceof Error ? e.message : "Something went wrong");
    }
  };
}
