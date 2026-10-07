"use client";

import { CalendarPlus, Check, ChevronDown, Clock, Download, Layers, List, Plus, SkipForward, StickyNote, Undo2, UserRoundCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PublicMember } from "@/lib/auth";
import { downloadIcs, googleCalendarUrl, suggestedTime, type CalendarEvent } from "@/lib/calendar";
import { daysBetween, formatDay, formatMinutes } from "@/lib/dates";
import { PILLAR_ORDER, PILLARS, pillarOf, systemOf } from "@/lib/systems";
import type { Task } from "@/lib/types";
import { Avatar, cx, Empty, LoadTag, PriorityTag, RepeatTag, SystemChip, TimePill } from "./ui";

async function act(id: string, action: string, assigneeId?: string) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, assigneeId }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't update");
}

function dueText(t: Task, today: string) {
  if (t.dueLabel) return t.dueLabel;
  if (!t.dueDate) return null;
  const d = daysBetween(today, t.dueDate);
  if (d < 0) return `Overdue · ${formatDay(t.dueDate, { weekday: "short" })}`;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `By ${formatDay(t.dueDate, { weekday: "long" })}`;
}

const CHEERS = ["Nice one!", "Boom. Done.", "One less thing!", "Look at you go!", "Teamwork 💪", "Off your plate!"];

function Burst() {
  const pieces = ["#F3776A", "#F6C35B", "#84A98C", "#8A6FD1", "#F3776A", "#F6C35B", "#84A98C", "#8A6FD1"];
  return (
    <span className="pointer-events-none absolute top-1/2 left-1/2" aria-hidden>
      {pieces.map((c, i) => (
        <span
          key={i}
          className="burst-piece absolute h-2.5 w-2.5 rounded-full"
          style={{ background: c, ["--dx" as string]: `${(i - 3.5) * 22}px`, animationDelay: `${i * 25}ms` }}
        />
      ))}
    </span>
  );
}

export function DayView(props: {
  greeting: string;
  dateLabel: string;
  today: string;
  me: PublicMember;
  target: PublicMember;
  members: PublicMember[];
  isAdmin: boolean;
  focus: Task[];
  doneToday: Task[];
  more: number;
  extra: number;
  capacityMinutes: number;
}) {
  const router = useRouter();
  const [view, setView] = useState<"system" | "flat">("system");
  const [justDone, setJustDone] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const self = props.target.id === props.me.id;

  const remaining = props.focus.filter((t) => !hidden.has(t.id));
  const total = props.focus.length + props.doneToday.length;
  const pendingDone = Object.keys(justDone).filter((id) => props.focus.some((t) => t.id === id)).length;
  const doneCount = props.doneToday.length + pendingDone;
  const remainingMinutes = remaining.filter((t) => !justDone[t.id]).reduce((s, t) => s + t.estimateMinutes, 0);

  async function run(t: Task, action: "done" | "skip" | "reassign", assigneeId?: string) {
    setError(null);
    if (action === "done") setJustDone((j) => ({ ...j, [t.id]: CHEERS[Math.floor(Math.random() * CHEERS.length)] }));
    try {
      await act(t.id, action, assigneeId);
      setTimeout(
        () => {
          setHidden((h) => new Set(h).add(t.id));
          startTransition(() => router.refresh());
        },
        action === "done" ? 900 : 0,
      );
    } catch (e) {
      setJustDone((j) => {
        const { [t.id]: _drop, ...rest } = j;
        return rest;
      });
      setError(e instanceof Error ? e.message : "Couldn't update");
    }
  }

  async function undo(t: Task) {
    await act(t.id, "undo").catch(() => {});
    startTransition(() => router.refresh());
  }

  const groups = PILLAR_ORDER.map((p) => ({ pillar: PILLARS[p], tasks: remaining.filter((t) => systemOf(t.system).pillar === p) })).filter((g) => g.tasks.length);
  const allClear = remaining.every((t) => justDone[t.id]);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-1 text-ink-2">
        {props.greeting} 👋 · {props.dateLabel}
      </p>
      <h1 className="text-4xl font-bold">{self ? "Your Day" : `${props.target.name}'s Day`}</h1>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[15px] text-ink-2">
        {total ? `${total - doneCount} of ${total} remaining` : "Nothing scheduled"}
        {remainingMinutes > 0 && (
          <span className="inline-flex items-center gap-1 font-bold text-coral-deep">
            · <Clock size={15} /> ~{formatMinutes(remainingMinutes)}
          </span>
        )}
        <span className="text-ink-3">· {formatMinutes(props.capacityMinutes)} available today</span>
      </p>

      {total > 0 && (
        <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={doneCount} aria-valuemax={total}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className="flex-1 transition-colors duration-500" style={{ background: i < doneCount ? "var(--sage)" : "transparent" }} />
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={() => setView("system")} className={cx("flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold", view === "system" ? "bg-coral text-white" : "bg-sand")}>
          <Layers size={16} /> By system
        </button>
        <button onClick={() => setView("flat")} className={cx("flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold", view === "flat" ? "bg-coral text-white" : "bg-sand")}>
          <List size={16} /> Flat list
        </button>
        {props.isAdmin && (
          <div className="ml-auto flex items-center gap-1 rounded-full bg-card p-1 shadow-sm ring-1 ring-line">
            {props.members.map((m) => (
              <Link key={m.id} href={m.id === props.me.id ? "/day" : `/day?member=${m.id}`} title={`${m.name}'s day`} className={cx("rounded-full p-0.5 transition", m.id === props.target.id ? "ring-2 ring-coral" : "opacity-60 hover:opacity-100")}>
                <Avatar m={m} size={28} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mt-4 rounded-xl bg-coral/10 px-3 py-2 text-sm font-semibold text-coral-deep">{error}</p>}

      <div className="mt-6 space-y-7">
        {remaining.length === 0 || allClear ? (
          <Empty
            emoji={doneCount ? "🎉" : "🌤️"}
            title={doneCount ? "That's a wrap on today!" : "Nothing on the list today"}
            body={doneCount ? "Everything you planned is done. Enjoy the margin." : self ? "Got something rattling around? Drop it in a brain dump." : undefined}
          >
            <div className="mt-5 flex gap-2">
              {props.more > 0 && (
                <Link href={`/day?${new URLSearchParams({ ...(self ? {} : { member: props.target.id }), more: String(props.extra + 1) })}`} className="flex items-center gap-1.5 rounded-full bg-sand px-4 py-2 text-sm font-bold hover:bg-sand-deep">
                  <Plus size={16} /> Pull one more
                </Link>
              )}
              {self && (
                <Link href="/" className="rounded-full bg-coral px-4 py-2 text-sm font-bold text-white hover:bg-coral-deep">
                  Brain dump
                </Link>
              )}
            </div>
          </Empty>
        ) : view === "system" ? (
          groups.map((g) => (
            <section key={g.pillar.id}>
              <h2 className="eyebrow mb-3 flex items-center gap-2" style={{ color: g.pillar.color }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.pillar.color }} />
                {g.pillar.name} <span className="font-semibold text-ink-3">· {g.tasks.length}</span>
              </h2>
              <div className="space-y-3">
                {g.tasks.map((t) => (
                  <TaskCard key={t.id} today={props.today} t={t} cheer={justDone[t.id]} onAct={run} members={props.members} meId={props.me.id} canAct={self || props.isAdmin} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="space-y-3">
            {remaining.map((t) => (
              <TaskCard key={t.id} today={props.today} t={t} cheer={justDone[t.id]} onAct={run} members={props.members} meId={props.me.id} canAct={self || props.isAdmin} />
            ))}
          </div>
        )}

        {remaining.length > 0 && !allClear && props.more > 0 && (
          <Link href={`/day?${new URLSearchParams({ ...(self ? {} : { member: props.target.id }), more: String(props.extra + 1) })}`} className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-sand-deep py-3 text-sm font-bold text-ink-2 hover:bg-sand">
            <Plus size={16} /> Feeling ambitious? Pull one more ({props.more} waiting)
          </Link>
        )}

        {props.doneToday.length > 0 && (
          <section>
            <h2 className="eyebrow mb-3 text-sage-deep">Done today · {props.doneToday.length}</h2>
            <ul className="card divide-y divide-line">
              {props.doneToday.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-sage text-white">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <span className="flex-1 text-sm font-semibold text-ink-2 line-through decoration-sand-deep">{t.title}</span>
                  <SystemChip system={t.system} size="xs" />
                  {(self || props.isAdmin) && (
                    <button onClick={() => undo(t)} className="rounded-full p-1.5 text-ink-3 hover:bg-sand hover:text-charcoal" aria-label="Undo">
                      <Undo2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function TaskCard({
  today,
  t,
  cheer,
  onAct,
  members,
  meId,
  canAct,
}: {
  today: string;
  t: Task;
  cheer?: string;
  onAct: (t: Task, a: "done" | "skip" | "reassign", to?: string) => void;
  members: PublicMember[];
  meId: string;
  canAct: boolean;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const pillar = pillarOf(t.system);
  const others = members.filter((m) => m.id !== t.assigneeId);

  return (
    <article className={cx("card relative overflow-hidden transition-all duration-500", cheer && "scale-[0.98] opacity-80")}>
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: pillar.color }} />
      <div className="p-5 pl-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className={cx("text-xl font-bold", cheer && "text-ink-3 line-through")}>{t.title}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <PriorityTag p={t.priority} />
              {dueText(t, today) && <span className="text-sm text-ink-2">· {dueText(t, today)}</span>}
              <TimePill minutes={t.estimateMinutes} />
              <SystemChip system={t.system} />
              <LoadTag load={t.cognitiveLoad} />
              {t.kind === "recurring" && <RepeatTag frequency={t.frequency} />}
            </div>
          </div>
          {t.context && (
            <button onClick={() => setNoteOpen(!noteOpen)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: pillar.soft, color: pillar.color }} aria-label="Toggle note">
              <StickyNote size={17} />
            </button>
          )}
        </div>

        {t.context && (
          <button onClick={() => setNoteOpen(!noteOpen)} className="mt-4 flex w-full items-start gap-2 rounded-2xl border border-mustard/40 bg-mustard-soft px-4 py-3 text-left text-[15px] text-ink-2">
            <StickyNote size={16} className="mt-0.5 shrink-0 text-mustard" />
            <span className={cx("flex-1", !noteOpen && "line-clamp-2")}>{t.context}</span>
            <ChevronDown size={16} className={cx("mt-0.5 shrink-0 transition", noteOpen && "rotate-180")} />
          </button>
        )}

        {t.skipCount >= 2 && !cheer && (
          <p className="mt-3 text-xs font-semibold text-[#B07A10]">Skipped {t.skipCount} times — maybe hand it off or let it go?</p>
        )}

        {canAct && (
          <div className="relative mt-4 flex gap-3">
            <button
              onClick={() => onAct(t, "done")}
              disabled={Boolean(cheer)}
              className="relative flex flex-1 items-center justify-center gap-2 rounded-2xl bg-sage py-3.5 font-bold text-white transition hover:bg-sage-deep active:scale-[0.98]"
            >
              {cheer ? (
                <>
                  <Burst />
                  <span className="animate-pop">{cheer}</span>
                </>
              ) : (
                <>
                  <Check size={18} strokeWidth={2.6} /> Done
                </>
              )}
            </button>
            <button onClick={() => onAct(t, "skip")} disabled={Boolean(cheer)} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-sand py-3.5 font-bold text-charcoal transition hover:bg-sand-deep">
              <SkipForward size={18} /> Skip
            </button>
            <button
              onClick={() => { setCalOpen(!calOpen); setHandoff(false); }}
              className={cx("grid w-12 place-items-center rounded-2xl text-ink-2 hover:bg-sand", calOpen && "bg-sand text-charcoal")}
              aria-label="Add to calendar"
              title="Add to my calendar"
            >
              <CalendarPlus size={19} />
            </button>
            {others.length > 0 && (
              <button onClick={() => { setHandoff(!handoff); setCalOpen(false); }} className="grid w-12 place-items-center rounded-2xl text-ink-2 hover:bg-sand" aria-label="Hand off" title="Hand off to someone">
                <UserRoundCog size={19} />
              </button>
            )}
            {handoff && (
              <div className="absolute right-0 bottom-full z-10 mb-2 w-56 rounded-2xl bg-card p-2 shadow-lg ring-1 ring-line">
                <p className="px-2 py-1 text-xs font-bold text-ink-2">Hand off to…</p>
                {others.map((m) => (
                  <button key={m.id} onClick={() => { setHandoff(false); onAct(t, "reassign", m.id); }} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold hover:bg-sand">
                    <Avatar m={m} size={24} /> {m.id === meId ? "Me" : m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {canAct && calOpen && <CalendarPanel t={t} today={today} />}
        {t.assignmentReason && !canAct && <p className="mt-3 text-xs text-ink-2">{t.assignmentReason}</p>}
      </div>
    </article>
  );
}

function CalendarPanel({ t, today }: { t: Task; today: string }) {
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(() => suggestedTime(today, today));
  const [added, setAdded] = useState(false);
  const event: CalendarEvent = {
    id: t.id,
    title: t.title,
    details: [t.context, `${systemOf(t.system).name} · about ${formatMinutes(t.estimateMinutes)}`, "From Better Together"].filter(Boolean).join("\n\n"),
    date,
    time,
    minutes: t.estimateMinutes,
  };
  const field = "rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-coral";

  return (
    <div className="animate-rise mt-3 rounded-2xl bg-offwhite p-4 ring-1 ring-line">
      <p className="text-sm font-bold">Block time for this</p>
      <p className="mt-0.5 text-xs text-ink-2">Pick when you&apos;ll do it — we&apos;ll add a {formatMinutes(Math.max(15, t.estimateMinutes || 30))} event with a 10-minute reminder.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => {
            setDate(e.target.value || today);
            setAdded(false);
          }}
          className={field}
          aria-label="Date"
        />
        <input
          type="time"
          value={time}
          step={900}
          onChange={(e) => {
            setTime(e.target.value || "09:00");
            setAdded(false);
          }}
          className={field}
          aria-label="Start time"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={googleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setAdded(true)}
          className="flex items-center gap-1.5 rounded-xl bg-coral px-3.5 py-2 text-sm font-bold text-white hover:bg-coral-deep"
        >
          <CalendarPlus size={16} /> Google Calendar
        </a>
        <button
          onClick={() => {
            downloadIcs(event);
            setAdded(true);
          }}
          className="flex items-center gap-1.5 rounded-xl bg-sand px-3.5 py-2 text-sm font-bold hover:bg-sand-deep"
        >
          <Download size={16} /> Apple / Outlook
        </button>
      </div>
      {added && <p className="mt-2 text-xs font-semibold text-sage-deep">Sent to your calendar — finish adding it there. ✓</p>}
    </div>
  );
}
