import { todayIn } from "./dates";
import { makeTask, titleKey } from "./tasks";
import type { Household, Proposal, Task } from "./types";

/** A reviewed item ready to become a task: a proposal plus whoever it ends up assigned to. */
export type CommitItem = Pick<
  Proposal,
  | "kind" | "title" | "system" | "priority" | "cognitiveLoad" | "estimateMinutes" | "dueDate" | "dueLabel"
  | "context" | "frequency" | "suggestedAssigneeId" | "assignmentReason" | "parentTitle" | "stepGroupId"
> & { assigneeId: string | null };

/**
 * Adds items to the household's to-dos. Shared by in-app review and hands-free (Siri) capture,
 * so both follow the same rules. Choosing someone other than the suggestion is recorded so
 * future suggestions learn from it.
 */
export function commitItems(h: Household, items: CommitItem[], actor: { id: string; name: string }, newId: () => string): Task[] {
  const ids = new Set(h.members.map((m) => m.id));
  const today = todayIn(h.timezone);
  return items.map((it) => {
    const assigneeId = it.kind === "idea" ? null : it.assigneeId && ids.has(it.assigneeId) ? it.assigneeId : actor.id;
    const overridden = Boolean(assigneeId && assigneeId !== it.suggestedAssigneeId);
    if (overridden) {
      h.signals.push({ at: new Date().toISOString(), system: it.system, titleKey: titleKey(it.title), suggestedId: it.suggestedAssigneeId, chosenId: assigneeId! });
      h.signals = h.signals.slice(-200);
    }
    const t = makeTask({
      id: newId(),
      title: it.title,
      system: it.system,
      kind: it.kind,
      priority: it.priority,
      cognitiveLoad: it.cognitiveLoad,
      estimateMinutes: it.estimateMinutes,
      dueDate: it.kind === "recurring" && !it.dueDate ? today : it.dueDate,
      dueLabel: it.dueLabel,
      context: it.context,
      frequency: it.frequency,
      assigneeId,
      assignmentReason: overridden ? `Assigned by ${actor.name}.` : it.assignmentReason,
      parentTitle: it.parentTitle ?? null,
      stepGroupId: it.stepGroupId ?? null,
      createdBy: actor.id,
    });
    if (t.kind === "recurring") t.seriesId = t.id;
    h.tasks.push(t);
    return t;
  });
}
