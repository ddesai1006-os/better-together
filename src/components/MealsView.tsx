"use client";

import { ChevronLeft, ChevronRight, ExternalLink, Plus, Trash2, UtensilsCrossed, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PublicMember } from "@/lib/auth";
import { formatDay } from "@/lib/dates";
import { linkLabel, MEAL_TYPES, mealType } from "@/lib/meals";
import type { MealIdea, MealPlanEntry, MealType } from "@/lib/types";
import { Avatar, cx, PageHeader } from "./ui";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Something went wrong");
}

export function MealsView(props: {
  offset: number;
  today: string;
  days: string[];
  ideas: MealIdea[];
  plan: MealPlanEntry[];
  members: PublicMember[];
  meId: string;
  isAdmin: boolean;
  adminName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const refresh = () => start(() => router.refresh());
  const ideaById = new Map(props.ideas.map((m) => [m.id, m]));

  async function run(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const planFor = (date: string) =>
    props.plan
      .filter((e) => e.date === date && ideaById.has(e.mealId))
      .sort((a, b) => MEAL_TYPES.findIndex((t) => t.id === ideaById.get(a.mealId)!.type) - MEAL_TYPES.findIndex((t) => t.id === ideaById.get(b.mealId)!.type));

  const weekLabel = props.offset === 0 ? "This week" : props.offset === 1 ? "Next week" : props.offset === -1 ? "Last week" : `${formatDay(props.days[0], { month: "short", day: "numeric" })} week`;

  return (
    <div className={cx(pending && "opacity-80 transition-opacity")}>
      <PageHeader
        title="Meals"
        sub={props.isAdmin ? "Everyone adds ideas — you put the week together." : `Add meal ideas anytime — ${props.adminName} puts the week together.`}
      />
      {error && <p className="mb-4 rounded-xl bg-coral/10 px-3 py-2 text-sm font-semibold text-coral-deep">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------------------ Plan */}
        <section className="card min-w-0 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">{weekLabel}&apos;s plan</h2>
              <p className="text-xs text-ink-2">
                {formatDay(props.days[0], { month: "short", day: "numeric" })} – {formatDay(props.days[6], { month: "short", day: "numeric" })}
              </p>
            </div>
            <div className="flex gap-1">
              <Link href={`/meals?w=${props.offset - 1}`} className={cx("rounded-full bg-sand p-2.5 hover:bg-sand-deep", props.offset <= -4 && "pointer-events-none opacity-40")} aria-label="Previous week">
                <ChevronLeft size={18} />
              </Link>
              {props.offset !== 0 && (
                <Link href="/meals" className="rounded-full bg-sand px-3 py-2.5 text-xs font-bold hover:bg-sand-deep">
                  Today
                </Link>
              )}
              <Link href={`/meals?w=${props.offset + 1}`} className={cx("rounded-full bg-sand p-2.5 hover:bg-sand-deep", props.offset >= 4 && "pointer-events-none opacity-40")} aria-label="Next week">
                <ChevronRight size={18} />
              </Link>
            </div>
          </div>

          <ul className="divide-y divide-line">
            {props.days.map((date) => (
              <DayRow
                key={date}
                date={date}
                isToday={date === props.today}
                entries={planFor(date)}
                ideaById={ideaById}
                ideas={props.ideas}
                isAdmin={props.isAdmin}
                onAdd={(mealId) => run(() => call("/api/meal-plan", "POST", { date, mealId }))}
                onRemove={(id) => run(() => call(`/api/meal-plan/${id}`, "DELETE"))}
              />
            ))}
          </ul>
        </section>

        {/* ----------------------------------------------------------- Ideas */}
        <section className="min-w-0">
          <AddIdea onAdd={(b) => run(() => call("/api/meals", "POST", b))} />
          <IdeaList
            ideas={props.ideas}
            members={props.members}
            meId={props.meId}
            isAdmin={props.isAdmin}
            days={props.days}
            plannedIds={new Set(props.plan.map((e) => e.mealId))}
            onPlan={(mealId, date) => run(() => call("/api/meal-plan", "POST", { date, mealId }))}
            onDelete={(id) => run(() => call(`/api/meals/${id}`, "DELETE"))}
          />
        </section>
      </div>
    </div>
  );
}

function DayRow({ date, isToday, entries, ideaById, ideas, isAdmin, onAdd, onRemove }: {
  date: string;
  isToday: boolean;
  entries: MealPlanEntry[];
  ideaById: Map<string, MealIdea>;
  ideas: MealIdea[];
  isAdmin: boolean;
  onAdd: (mealId: string) => void;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <li className="flex gap-3 py-3">
      <div className="w-12 shrink-0 pt-1 text-center">
        <p className={cx("text-xs font-bold uppercase", isToday ? "text-coral-deep" : "text-ink-2")}>{formatDay(date, { weekday: "short" })}</p>
        <p className={cx("mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-bold", isToday ? "bg-coral text-white" : "text-charcoal")}>
          {Number(date.slice(8))}
        </p>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 pt-1">
        {entries.length === 0 && !adding && <p className="py-1 text-sm text-ink-3">{isAdmin ? "Nothing planned yet" : "—"}</p>}
        {entries.map((e) => {
          const m = ideaById.get(e.mealId)!;
          const t = mealType(m.type);
          return (
            <div key={e.id} className="flex items-center gap-2 rounded-xl bg-offwhite py-1 pr-1 pl-3">
              <span title={t.label}>{t.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{m.name}</p>
                <p className="text-[11px] text-ink-2">{t.label}</p>
              </div>
              {m.url && (
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-sand hover:text-charcoal" aria-label={`Open recipe for ${m.name}`} title="Open recipe">
                  <ExternalLink size={15} />
                </a>
              )}
              {isAdmin && (
                <button onClick={() => onRemove(e.id)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-sand hover:text-charcoal" aria-label={`Remove ${m.name} from ${date}`}>
                  <X size={15} />
                </button>
              )}
            </div>
          );
        })}
        {isAdmin &&
          (adding ? (
            <div className="flex items-center gap-2">
              <select
                autoFocus
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) onAdd(e.target.value);
                  setAdding(false);
                }}
                onBlur={() => setAdding(false)}
                className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm"
                aria-label="Choose a meal"
              >
                <option value="" disabled>
                  {ideas.length ? "Choose a meal idea…" : "Add an idea first →"}
                </option>
                {MEAL_TYPES.map((t) => {
                  const group = ideas.filter((m) => m.type === t.id);
                  return group.length ? (
                    <optgroup key={t.id} label={`${t.emoji} ${t.label}`}>
                      {group.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
              </select>
              <button onClick={() => setAdding(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-sand" aria-label="Cancel">
                <X size={15} />
              </button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="-ml-1 flex items-center gap-1 rounded-full px-3 py-2.5 text-xs font-bold text-coral-deep hover:bg-coral/10">
              <Plus size={14} /> Add meal
            </button>
          ))}
      </div>
    </li>
  );
}

function AddIdea({ onAdd }: { onAdd: (b: { name: string; url: string; type: MealType }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<MealType>("dinner");
  const [busy, setBusy] = useState(false);
  const field = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-coral focus:ring-4 focus:ring-coral/10";

  return (
    <form
      className="card p-5 sm:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        await onAdd({ name, url, type });
        setName("");
        setUrl("");
        setBusy(false);
      }}
    >
      <h2 className="text-lg font-bold">Suggest a meal</h2>
      <div className="mt-3 space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meal name, e.g. Sheet-pan fajitas" className={field} aria-label="Meal name" maxLength={100} required />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Recipe link (optional)" className={field} aria-label="Recipe link" inputMode="url" autoCapitalize="none" />
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Meal type">
          {MEAL_TYPES.map((t) => (
            <button
              type="button"
              key={t.id}
              role="radio"
              aria-checked={type === t.id}
              onClick={() => setType(t.id)}
              className={cx("rounded-full px-3 py-1.5 text-sm font-semibold transition", type === t.id ? "bg-coral text-white" : "bg-sand text-charcoal hover:bg-sand-deep")}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
        <button disabled={busy || !name.trim()} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-coral py-3 font-bold text-white hover:bg-coral-deep disabled:opacity-50">
          <Plus size={18} /> Add idea
        </button>
      </div>
    </form>
  );
}

function IdeaList({ ideas, members, meId, isAdmin, days, plannedIds, onPlan, onDelete }: {
  ideas: MealIdea[];
  members: PublicMember[];
  meId: string;
  isAdmin: boolean;
  days: string[];
  plannedIds: Set<string>;
  onPlan: (mealId: string, date: string) => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<MealType | "all">("all");
  const [planning, setPlanning] = useState<string | null>(null);
  const byId = new Map(members.map((m) => [m.id, m]));
  const shown = filter === "all" ? ideas : ideas.filter((m) => m.type === filter);

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Meal ideas · {ideas.length}</h2>
      </div>
      {ideas.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[{ id: "all" as const, label: "All", emoji: "" }, ...MEAL_TYPES].map((t) => {
            const count = t.id === "all" ? ideas.length : ideas.filter((m) => m.type === t.id).length;
            if (t.id !== "all" && count === 0) return null;
            return (
              <button key={t.id} onClick={() => setFilter(t.id)} className={cx("rounded-full px-3 py-2 text-xs font-bold", filter === t.id ? "bg-charcoal text-white" : "bg-sand text-charcoal")}>
                {t.emoji} {t.label} {count}
              </button>
            );
          })}
        </div>
      )}
      {shown.length === 0 ? (
        <div className="card flex flex-col items-center px-5 py-8 text-center text-sm text-ink-2">
          <UtensilsCrossed size={24} className="mb-2 text-ink-3" strokeWidth={1.8} />
          No ideas yet — add the first one above.
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((m) => {
            const t = mealType(m.type);
            const who = byId.get(m.submittedBy);
            const canDelete = isAdmin || m.submittedBy === meId;
            return (
              <li key={m.id} className="card py-2 pr-2 pl-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl" title={t.label}>{t.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{m.name}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-2">
                      <span>{t.label}</span>
                      {m.url && (
                        <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-coral-deep hover:underline">
                          {linkLabel(m.url)} <ExternalLink size={11} />
                        </a>
                      )}
                      {plannedIds.has(m.id) && <span className="rounded-full bg-sage-soft px-1.5 font-semibold text-sage-deep">On the plan</span>}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-ink-2" title={`Suggested by ${who?.name ?? "someone"}`}>
                    <Avatar m={who} size={24} />
                    <span className="hidden sm:inline">{who ? (who.id === meId ? "You" : who.name) : ""}</span>
                  </span>
                  {isAdmin && (
                    <button onClick={() => setPlanning(planning === m.id ? null : m.id)} className={cx("rounded-full px-3 py-2 text-xs font-bold", planning === m.id ? "bg-coral text-white" : "bg-sand text-charcoal hover:bg-sand-deep")} aria-label={`Add ${m.name} to the plan`} aria-expanded={planning === m.id}>
                      Plan
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => onDelete(m.id)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-sand hover:text-charcoal" aria-label={`Delete ${m.name}`} title="Delete idea">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {planning === m.id && (
                  <div className="animate-rise mt-3 border-t border-line pt-3">
                    <p className="mb-2 text-xs font-bold text-ink-2">Add to which day?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {days.map((d) => (
                        <button
                          key={d}
                          onClick={() => {
                            onPlan(m.id, d);
                            setPlanning(null);
                          }}
                          className="rounded-full bg-sand px-3.5 py-2.5 text-xs font-bold hover:bg-coral hover:text-white"
                        >
                          {formatDay(d, { weekday: "short" })} {Number(d.slice(8))}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
