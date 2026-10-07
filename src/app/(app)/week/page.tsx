import { ArrowRight, ChevronLeft, ChevronRight, Flame, Waves } from "lucide-react";
import Link from "next/link";
import { Legend, Ring, ShareBar, StackedColumns } from "@/components/charts";
import { WeekLists } from "@/components/WeekLists";
import { Avatar, PageHeader } from "@/components/ui";
import { publicMember, requireViewer } from "@/lib/auth";
import { formatDay, formatMinutes } from "@/lib/dates";
import { rhythmStats, weekStats } from "@/lib/stats";
import { PILLAR_ORDER, PILLARS } from "@/lib/systems";
import type { SystemId } from "@/lib/types";

const BADGES: Record<SystemId, string> = {
  meals: "Meal Maestro", laundry: "Laundry Legend", calendar: "Logistics Wizard", maintenance: "Fix-it Hero",
  admin: "Paperwork Pro", budget: "Money Minder", organization: "Clutter Buster", alignment: "Family Captain",
  health: "Wellness Champ", experiences: "Adventure Scout", learning: "Lifelong Learner", relationships: "Connection Keeper",
};

function vibe(pct: number, isCurrent: boolean) {
  if (!isCurrent) return pct >= 80 ? "What a week that was." : pct >= 50 ? "A solid, steady week." : "A full week — and you got through it.";
  if (pct >= 85) return "You're crushing it together.";
  if (pct >= 60) return "Strong week — the finish line is in sight.";
  if (pct >= 30) return "Good momentum. Keep passing the baton.";
  return "Fresh week, fresh start. One thing at a time.";
}

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { household, me, isAdmin } = await requireViewer();
  const offset = Math.min(0, Math.max(-8, Number((await searchParams).w) || 0));
  const s = weekStats(household, offset);
  const members = household.members.map(publicMember);
  const series = members.map((m) => ({ key: m.id, name: m.name, color: m.color }));
  const maxMinutes = Math.max(1, ...s.members.map((x) => x.minutes));
  const rhythms = rhythmStats(household, 6);
  const teaser = [...rhythms.insights].sort((a, b) => (a.tone === "heads-up" ? -1 : 0) - (b.tone === "heads-up" ? -1 : 0)).slice(0, 2);

  return (
    <div>
      <PageHeader
        eyebrow={`${formatDay(s.start, { month: "short", day: "numeric" })} – ${formatDay(s.end, { month: "short", day: "numeric" })}`}
        title={s.isCurrent ? "This Week" : offset === -1 ? "Last Week" : `${-offset} Weeks Ago`}
        sub="How the household is doing — together."
        right={
          <div className="flex items-center gap-1">
            <Link href={`/week?w=${offset - 1}`} className="rounded-full bg-sand p-2.5 hover:bg-sand-deep" aria-label="Previous week">
              <ChevronLeft size={18} />
            </Link>
            {!s.isCurrent && (
              <Link href={`/week?w=${offset + 1}`} className="rounded-full bg-sand p-2.5 hover:bg-sand-deep" aria-label="Next week">
                <ChevronRight size={18} />
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Hero */}
        <section className="card flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <Ring pct={s.pct} size={148} stroke={14}>
            <div>
              <p className="text-4xl font-bold tabular-nums">{s.pct}%</p>
              <p className="text-xs font-semibold text-ink-2">complete</p>
            </div>
          </Ring>
          <div className="min-w-0">
            <p className="text-xl font-bold leading-snug">{vibe(s.pct, s.isCurrent)}</p>
            <p className="mt-2 text-ink-2">
              <b className="text-charcoal">{s.completed.length}</b> things done · <b className="text-charcoal">{formatMinutes(s.minutesDone)}</b> of care for the household
              {s.remaining.length > 0 && <> · <b className="text-charcoal">{s.remaining.length}</b> still to go</>}
            </p>
            {s.isCurrent && s.streak > 1 && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mustard-soft px-3 py-1.5 text-sm font-bold text-charcoal">
                <Flame size={16} className="text-coral" /> {s.streak}-day household streak
              </p>
            )}
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-bold text-ink-2">Where the time went</p>
              <ShareBar parts={PILLAR_ORDER.map((p) => ({ key: p, name: PILLARS[p].name, value: s.pillarMinutes[p], color: PILLARS[p].color }))} />
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
                {PILLAR_ORDER.map((p) => (
                  <li key={p} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: PILLARS[p].color }} />
                    {PILLARS[p].name} <b className="text-charcoal">{formatMinutes(s.pillarMinutes[p])}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Daily rhythm */}
        <section className="card p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">Done each day</h2>
            <Legend series={series} />
          </div>
          <StackedColumns
            data={s.days.map((d) => ({ label: d.label, values: d.byMember, highlight: d.date === s.today, sub: formatDay(d.date) }))}
            series={series}
            unit=" done"
          />
        </section>
      </div>

      {/* Team */}
      <h2 className="mt-8 mb-3 text-lg font-bold">The team</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => {
          const st = s.members.find((x) => x.id === m.id)!;
          return (
            <div key={m.id} className="card p-5">
              <div className="flex items-center gap-3">
                <Avatar m={m} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{m.id === me.id ? `${m.name} (you)` : m.name}</p>
                  {st.topSystem ? (
                    <p className="text-xs font-semibold text-ink-2">
                      {BADGES[st.topSystem]} this week
                    </p>
                  ) : (
                    <p className="text-xs text-ink-3">Warming up</p>
                  )}
                </div>
                <p className="text-2xl font-bold tabular-nums">{st.pct}%</p>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-sand">
                <div className="h-full rounded-full" style={{ width: `${st.pct}%`, background: m.color }} />
              </div>
              <div className="mt-3 flex justify-between text-xs text-ink-2">
                <span><b className="text-charcoal">{st.done}</b> done · <b className="text-charcoal">{st.remaining}</b> left</span>
                <span title="Share of household minutes this week">
                  {formatMinutes(st.minutes)} · {Math.round((st.minutes / Math.max(1, s.minutesDone)) * 100)}% of the work
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sand/60">
                <div className="h-full rounded-full bg-ink-3/50" style={{ width: `${(st.minutes / maxMinutes) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Rhythms: a monthly look-back, surfaced here rather than as a daily tab */}
      {rhythms.totalTasks > 0 && (
        <Link href="/rhythms" className="card group mt-8 block overflow-hidden transition hover:border-plum">
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-plum/15 text-plum">
              <Waves size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-plum">Household Rhythms · last {rhythms.weeks} weeks</p>
              <p className="mt-1 text-lg font-bold">How your home has been running</p>
              <ul className="mt-2 space-y-1 text-sm text-ink-2">
                {teaser.map((i) => (
                  <li key={i.title}>• {i.title}</li>
                ))}
              </ul>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-plum">
              See the full picture <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      )}

      <WeekLists
        completed={s.completed}
        remaining={s.remaining}
        members={members}
        today={s.today}
        canReassign={isAdmin}
        meId={me.id}
      />
    </div>
  );
}
