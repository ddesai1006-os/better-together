"use client";

import { Check, CircleCheckBig, HandHeart, Sprout } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PublicMember } from "@/lib/auth";
import { formatDay, formatMinutes } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { Avatar, cx, Empty, PriorityTag, RepeatTag, SystemChip } from "./ui";

export function WeekLists({
  completed,
  remaining,
  members,
  today,
  canReassign,
  meId,
}: {
  completed: Task[];
  remaining: Task[];
  members: PublicMember[];
  today: string;
  canReassign: boolean;
  meId: string;
}) {
  const [tab, setTab] = useState<"left" | "wins">("left");
  const [pending, start] = useTransition();
  const router = useRouter();
  const byId = new Map(members.map((m) => [m.id, m]));

  async function reassign(id: string, to: string) {
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reassign", assigneeId: to }) });
    start(() => router.refresh());
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex gap-2">
        <button onClick={() => setTab("left")} className={cx("rounded-full px-4 py-2 text-sm font-bold", tab === "left" ? "bg-coral text-white" : "bg-sand")}>
          Still to do · {remaining.length}
        </button>
        <button onClick={() => setTab("wins")} className={cx("rounded-full px-4 py-2 text-sm font-bold", tab === "wins" ? "bg-sage text-white" : "bg-sand")}>
          Wins · {completed.length}
        </button>
      </div>

      {tab === "left" ? (
        remaining.length === 0 ? (
          <Empty icon={CircleCheckBig} title="Nothing left this week" body="Every planned thing is done. Take a breath — you earned it." />
        ) : (
          <ul className={cx("card divide-y divide-line", pending && "opacity-70")}>
            {remaining.map((t) => {
              const who = byId.get(t.assigneeId ?? "");
              const overdue = t.dueDate !== null && t.dueDate < today;
              return (
                <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5"><Avatar m={who} size={30} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-semibold">{t.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
                      <PriorityTag p={t.priority} />
                      <span className={cx(overdue && "font-bold text-coral-deep")}>
                        {overdue ? "Overdue · " : ""}
                        {t.dueDate ? formatDay(t.dueDate) : ""}
                      </span>
                      <span>{formatMinutes(t.estimateMinutes)}</span>
                      {t.kind === "recurring" && <RepeatTag frequency={t.frequency} />}
                      <SystemChip system={t.system} size="xs" />
                    </div>
                  </div>
                  {canReassign ? (
                    <select
                      value={t.assigneeId ?? ""}
                      onChange={(e) => reassign(t.id, e.target.value)}
                      className="shrink-0 rounded-full border border-line bg-white px-2.5 py-2 text-xs font-semibold"
                      aria-label="Reassign"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    t.assigneeId !== meId && (
                      <button onClick={() => reassign(t.id, meId)} className="flex shrink-0 items-center gap-1 rounded-full bg-sage-soft px-3 py-2 text-xs font-bold text-sage-deep hover:brightness-95" title="Take this one off their plate">
                        <HandHeart size={14} /> I&apos;ll take it
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )
      ) : completed.length === 0 ? (
        <Empty icon={Sprout} title="No wins yet this week" body="The first one's always the hardest." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {completed.map((t) => {
            const who = byId.get(t.completedBy ?? "");
            return (
              <li key={t.id} className="card flex items-center gap-3 px-4 py-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sage text-white">
                  <Check size={15} strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.title}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-2">
                    <span>
                      {who?.name ?? "Someone"} · {t.completedAt ? new Date(t.completedAt).toLocaleDateString("en-US", { weekday: "short" }) : ""}
                    </span>
                    {t.kind === "recurring" && <RepeatTag frequency={t.frequency} />}
                  </p>
                </div>
                <SystemChip system={t.system} size="xs" />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
