"use client";

import { ChevronDown, HelpCircle, Repeat, Sparkles, Undo2, X } from "lucide-react";
import { useState } from "react";
import type { PublicMember } from "@/lib/auth";
import { PILLAR_ORDER, PILLARS, pillarOf, SYSTEMS } from "@/lib/systems";
import type { Proposal } from "@/lib/types";
import { Avatar, cx, LoadTag, PriorityTag, SystemChip, TimePill } from "./ui";

export type Draft = Proposal & { assigneeId: string | null; answer: string; include: boolean };

const KIND_LABEL = { task: "Task", recurring: "Routine", reminder: "Reminder", idea: "Idea" } as const;

export function ReviewList({
  drafts,
  setDrafts,
  members,
  meId,
}: {
  drafts: Draft[];
  setDrafts: React.Dispatch<React.SetStateAction<Draft[]>>;
  members: PublicMember[];
  meId: string;
}) {
  const update = (id: string, patch: Partial<Draft>) => setDrafts((all) => all.map((d) => (d.tempId === id ? { ...d, ...patch } : d)));

  if (drafts.length === 0) {
    return <p className="card p-6 text-center text-ink-2">Nothing actionable found — try adding a bit more detail.</p>;
  }

  return (
    <ul className="space-y-3">
      {drafts.map((d) => (
        <ReviewCard key={d.tempId} d={d} members={members} meId={meId} update={(p) => update(d.tempId, p)} />
      ))}
    </ul>
  );
}

function ReviewCard({ d, members, meId, update }: { d: Draft; members: PublicMember[]; meId: string; update: (p: Partial<Draft>) => void }) {
  const [open, setOpen] = useState(false);
  const pillar = pillarOf(d.system);
  const field = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral";

  if (!d.include) {
    return (
      <li className="flex items-center justify-between rounded-2xl border border-dashed border-sand-deep px-4 py-3 text-sm text-ink-3">
        <span className="line-through">{d.title}</span>
        <button onClick={() => update({ include: true })} className="flex items-center gap-1 font-bold text-ink-2 hover:text-charcoal">
          <Undo2 size={14} /> Keep
        </button>
      </li>
    );
  }

  return (
    <li className="card animate-rise relative overflow-hidden">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: pillar.color }} />
      <div className="p-4 pl-5">
        <div className="flex items-start gap-2">
          <input
            value={d.title}
            onChange={(e) => update({ title: e.target.value })}
            className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-0.5 text-[17px] font-bold outline-none focus:bg-white focus:ring-2 focus:ring-coral/30"
            aria-label="Title"
          />
          <span className="mt-1 shrink-0 rounded-full bg-sand px-2 py-0.5 text-[11px] font-bold tracking-wide text-ink-2 uppercase">
            {d.kind === "recurring" ? (
              <span className="flex items-center gap-1">
                <Repeat size={11} /> {d.frequency}
              </span>
            ) : (
              KIND_LABEL[d.kind]
            )}
          </span>
          <button onClick={() => update({ include: false })} className="mt-0.5 rounded-full p-1 text-ink-3 hover:bg-sand hover:text-charcoal" aria-label="Remove">
            <X size={16} />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
          {d.kind !== "idea" && <PriorityTag p={d.priority} />}
          {d.dueLabel && <span className="text-xs font-semibold text-ink-2">· {d.dueLabel}</span>}
          {d.kind !== "idea" && <TimePill minutes={d.estimateMinutes} />}
          <SystemChip system={d.system} />
          {d.kind !== "idea" && <LoadTag load={d.cognitiveLoad} />}
        </div>

        {d.context && !open && <p className="mt-3 rounded-xl bg-mustard-soft px-3 py-2 text-sm text-charcoal">{d.context}</p>}

        {d.clarifyingQuestion && (
          <div className="mt-3 rounded-xl border border-mustard/60 bg-mustard-soft p-3">
            <p className="flex items-start gap-1.5 text-sm font-semibold text-charcoal">
              <HelpCircle size={16} className="mt-0.5 shrink-0 text-[#B07A10]" /> {d.clarifyingQuestion}
            </p>
            <input value={d.answer} onChange={(e) => update({ answer: e.target.value })} placeholder="Quick answer (optional)" className={cx(field, "mt-2")} />
          </div>
        )}

        {d.kind !== "idea" && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              {members.map((m) => {
                const selected = d.assigneeId === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => update({ assigneeId: m.id })}
                    className={cx(
                      "flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-semibold transition",
                      selected ? "border-transparent text-white shadow-sm" : "border-line bg-white text-charcoal hover:border-sand-deep",
                    )}
                    style={selected ? { background: m.color } : undefined}
                  >
                    <Avatar m={m} size={26} />
                    {m.id === meId ? "Me" : m.name}
                  </button>
                );
              })}
            </div>
            {d.assignmentReason && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-2">
                <Sparkles size={13} className="mt-px shrink-0 text-[#B07A10]" />
                {d.assigneeId === d.suggestedAssigneeId ? d.assignmentReason : "You changed this — Better Together will remember for next time."}
              </p>
            )}
          </div>
        )}

        <button onClick={() => setOpen(!open)} className="mt-3 flex items-center gap-1 text-xs font-bold text-ink-2 hover:text-charcoal">
          <ChevronDown size={14} className={cx("transition", open && "rotate-180")} /> {open ? "Done editing" : "Edit details"}
        </button>

        {open && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="col-span-2 sm:col-span-1">
              <span className="mb-1 block text-xs font-bold text-ink-2">Type</span>
              <select value={d.kind} onChange={(e) => update({ kind: e.target.value as Draft["kind"], frequency: e.target.value === "recurring" ? d.frequency ?? "weekly" : null })} className={field}>
                {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            {d.kind === "recurring" && (
              <label>
                <span className="mb-1 block text-xs font-bold text-ink-2">Repeats</span>
                <select value={d.frequency ?? "weekly"} onChange={(e) => update({ frequency: e.target.value as Draft["frequency"] })} className={field}>
                  {["daily", "weekly", "biweekly", "monthly"].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
            )}
            <label className="col-span-2">
              <span className="mb-1 block text-xs font-bold text-ink-2">System</span>
              <select value={d.system} onChange={(e) => update({ system: e.target.value as Draft["system"] })} className={field}>
                {PILLAR_ORDER.map((p) => (
                  <optgroup key={p} label={PILLARS[p].name}>
                    {SYSTEMS.filter((s) => s.pillar === p).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            {d.kind !== "idea" && (
              <>
                <label>
                  <span className="mb-1 block text-xs font-bold text-ink-2">Priority</span>
                  <select value={d.priority} onChange={(e) => update({ priority: e.target.value as Draft["priority"] })} className={field}>
                    <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold text-ink-2">Mental load</span>
                  <select value={d.cognitiveLoad} onChange={(e) => update({ cognitiveLoad: e.target.value as Draft["cognitiveLoad"] })} className={field}>
                    <option value="light">Light</option><option value="moderate">Moderate</option><option value="heavy">Heavy</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold text-ink-2">Minutes</span>
                  <input type="number" min={5} step={5} value={d.estimateMinutes} onChange={(e) => update({ estimateMinutes: Math.max(0, Number(e.target.value) || 0) })} className={field} />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold text-ink-2">Due</span>
                  <input type="date" value={d.dueDate ?? ""} onChange={(e) => update({ dueDate: e.target.value || null, dueLabel: null })} className={field} />
                </label>
              </>
            )}
            <label className="col-span-2 sm:col-span-3">
              <span className="mb-1 block text-xs font-bold text-ink-2">Context</span>
              <textarea value={d.context} onChange={(e) => update({ context: e.target.value })} rows={2} className={field} />
            </label>
          </div>
        )}
      </div>
    </li>
  );
}
