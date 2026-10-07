import { NextResponse } from "next/server";
import { z } from "zod";
import { todayIn } from "@/lib/dates";
import { newId, updateHousehold } from "@/lib/db";
import { route } from "@/lib/http";
import { SYSTEM_IDS } from "@/lib/systems";
import { makeTask, titleKey } from "@/lib/tasks";

const Item = z.object({
  kind: z.enum(["task", "recurring", "reminder", "idea"]),
  title: z.string().trim().min(1).max(140),
  system: z.enum(SYSTEM_IDS),
  priority: z.enum(["high", "medium", "low"]),
  cognitiveLoad: z.enum(["light", "moderate", "heavy"]),
  estimateMinutes: z.number().int().min(0).max(600),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  dueLabel: z.string().max(60).nullable(),
  context: z.string().max(1000),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly"]).nullable(),
  assigneeId: z.string().nullable(),
  suggestedAssigneeId: z.string().nullable(),
  assignmentReason: z.string().max(300),
  parentTitle: z.string().max(140).nullable().optional(),
  stepGroupId: z.string().max(40).nullable().optional(),
});
const Body = z
  .object({
    items: z.array(Item).max(30).default([]),
    /** Duplicates the reviewer chose to fold into an existing task (adds the new details). */
    merges: z.array(z.object({ taskId: z.string(), context: z.string().max(1000) })).max(30).default([]),
    /** The inbox item these came from, marked reviewed. */
    inboxId: z.string().optional(),
  })
  .refine((b) => b.items.length + b.merges.length > 0, "Nothing to send");

/** Commits reviewed brain-dump items. Overrides of the AI's pick are recorded as learning signals. */
export const POST = route(Body, async ({ household, me }, { items, merges, inboxId }) => {
  const created = await updateHousehold(household.id, (h) => {
    const ids = new Set(h.members.map((m) => m.id));
    const today = todayIn(h.timezone);
    const out = items.map((it) => {
      const assigneeId = it.kind === "idea" ? null : it.assigneeId && ids.has(it.assigneeId) ? it.assigneeId : me.id;
      const overridden = assigneeId && assigneeId !== it.suggestedAssigneeId;
      if (overridden) {
        h.signals.push({ at: new Date().toISOString(), system: it.system, titleKey: titleKey(it.title), suggestedId: it.suggestedAssigneeId, chosenId: assigneeId });
        h.signals = h.signals.slice(-200);
      }
      const t = makeTask({
        id: newId("t_"),
        ...it,
        dueDate: it.kind === "recurring" && !it.dueDate ? today : it.dueDate,
        assigneeId,
        assignmentReason: overridden ? `Assigned by ${me.name}.` : it.assignmentReason,
        createdBy: me.id,
      });
      if (t.kind === "recurring") t.seriesId = t.id;
      h.tasks.push(t);
      return t;
    });
    for (const m of merges) {
      const t = h.tasks.find((x) => x.id === m.taskId);
      const extra = m.context.trim();
      if (t && extra && !t.context.includes(extra)) t.context = t.context ? `${t.context}\n${extra}` : extra;
    }
    const item = inboxId ? h.inbox?.find((i) => i.id === inboxId) : undefined;
    if (item && item.status === "new") {
      Object.assign(item, { status: "reviewed", outcome: "tasks", taskCount: items.length + merges.length, reviewedBy: me.id, reviewedAt: new Date().toISOString() });
    }
    return out;
  });
  return NextResponse.json({ created: created.length });
});
