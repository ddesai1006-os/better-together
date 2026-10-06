import { NextResponse } from "next/server";
import { z } from "zod";
import { todayIn } from "@/lib/dates";
import { newId, updateHousehold } from "@/lib/db";
import { fail, route } from "@/lib/http";
import { completeTask, reopenTask, titleKey } from "@/lib/tasks";

const Body = z.object({
  action: z.enum(["done", "skip", "undo", "reassign", "delete", "activate"]),
  assigneeId: z.string().optional(),
});

const idFrom = (req: Request) => decodeURIComponent(new URL(req.url).pathname.split("/").pop() ?? "");

export const PATCH = route(Body, async ({ household, me, isAdmin }, body, req) => {
  const id = idFrom(req);
  const result = await updateHousehold(household.id, (h) => {
    const task = h.tasks.find((t) => t.id === id);
    if (!task) return fail(404, "That task no longer exists.");
    const mine = task.assigneeId === me.id || task.completedBy === me.id || task.assigneeId === null;
    const takingIt = body.action === "reassign" && body.assigneeId === me.id;
    if (!isAdmin && !mine && !takingIt) return fail(403, "You can only update your own tasks.");
    const today = todayIn(h.timezone);
    switch (body.action) {
      case "done":
        if (task.status === "open") completeTask(h, task, me.id, today, () => newId("t_"));
        break;
      case "undo":
        if (task.status === "done") reopenTask(h, task);
        else if (task.skippedOn === today) {
          task.skippedOn = null;
          task.skipCount = Math.max(0, task.skipCount - 1);
        }
        break;
      case "skip":
        task.skippedOn = today;
        task.skipCount += 1;
        break;
      case "activate": // turn a parked idea into a real task
        task.kind = "task";
        task.assigneeId = body.assigneeId && h.members.some((m) => m.id === body.assigneeId) ? body.assigneeId : me.id;
        task.estimateMinutes ||= 30;
        task.assignmentReason = `Picked up by ${me.name}.`;
        break;
      case "reassign": {
        const to = h.members.find((m) => m.id === body.assigneeId);
        if (!to) return fail(400, "Pick someone in the household.");
        h.signals.push({ at: new Date().toISOString(), system: task.system, titleKey: titleKey(task.title), suggestedId: task.assigneeId, chosenId: to.id });
        task.assigneeId = to.id;
        task.skippedOn = null;
        task.assignmentReason = to.id === me.id ? `${me.name} picked this up.` : `Handed off by ${me.name}.`;
        break;
      }
      case "delete":
        h.tasks = h.tasks.filter((t) => t.id !== id);
        break;
    }
    return null;
  });
  return result ?? NextResponse.json({ ok: true });
});
