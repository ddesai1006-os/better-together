import { addDays, addMonths } from "./dates";
import type { Frequency, Household, Task } from "./types";

export function makeTask(partial: Partial<Task> & Pick<Task, "id" | "title" | "system" | "createdBy">): Task {
  return {
    kind: "task",
    priority: "medium",
    cognitiveLoad: "light",
    estimateMinutes: 15,
    dueDate: null,
    dueLabel: null,
    context: "",
    frequency: null,
    assigneeId: null,
    assignmentReason: "",
    status: "open",
    createdAt: new Date().toISOString(),
    completedAt: null,
    completedBy: null,
    skippedOn: null,
    skipCount: 0,
    seriesId: null,
    ...partial,
  };
}

export function nextDue(from: string, freq: Frequency): string {
  switch (freq) {
    case "daily":
      return addDays(from, 1);
    case "weekly":
      return addDays(from, 7);
    case "biweekly":
      return addDays(from, 14);
    case "monthly":
      return addMonths(from, 1);
  }
}

/**
 * Marks a task done. Recurring tasks spawn their next instance, staying with whoever
 * actually did it — routines naturally follow the person who handles them.
 */
export function completeTask(h: Household, task: Task, byId: string, today: string, newId: () => string) {
  task.status = "done";
  task.completedAt = new Date().toISOString();
  task.completedBy = byId;
  if (task.kind === "recurring" && task.frequency) {
    const base = task.dueDate && task.dueDate > today ? task.dueDate : today;
    h.tasks.push({
      ...task,
      id: newId(),
      status: "open",
      dueDate: nextDue(base, task.frequency),
      createdAt: new Date().toISOString(),
      completedAt: null,
      completedBy: null,
      skippedOn: null,
      skipCount: 0,
      assigneeId: byId,
      seriesId: task.seriesId ?? task.id,
    });
  }
}

/** Undo a completion; also removes the auto-spawned next instance if untouched. */
export function reopenTask(h: Household, task: Task) {
  if (task.kind === "recurring") {
    const series = task.seriesId ?? task.id;
    const spawned = h.tasks.findIndex(
      (t) => t.id !== task.id && (t.seriesId ?? t.id) === series && t.status === "open" && t.createdAt >= (task.completedAt ?? ""),
    );
    if (spawned >= 0) h.tasks.splice(spawned, 1);
  }
  task.status = "open";
  task.completedAt = null;
  task.completedBy = null;
}

export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\b(the|a|an|my|our|to|for|and)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
