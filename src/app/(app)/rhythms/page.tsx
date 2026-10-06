import { Lightbulb, PartyPopper, Scale } from "lucide-react";
import { Legend, ShareBar, StackedColumns } from "@/components/charts";
import { Avatar, Empty, PageHeader } from "@/components/ui";
import { publicMember, requireViewer } from "@/lib/auth";
import { formatDay, formatMinutes } from "@/lib/dates";
import { rhythmStats } from "@/lib/stats";
import { PILLAR_ORDER, PILLARS, systemOf } from "@/lib/systems";

const TONE = {
  good: { Icon: PartyPopper, bg: "var(--sage-soft)", fg: "var(--sage-deep)" },
  "heads-up": { Icon: Scale, bg: "#FCE7E3", fg: "var(--coral-deep)" },
  idea: { Icon: Lightbulb, bg: "var(--mustard-soft)", fg: "#B07A10" },
} as const;

export default async function RhythmsPage() {
  const { household } = await requireViewer();
  const r = rhythmStats(household, 6);
  const members = household.members.map(publicMember);
  const byId = new Map(members.map((m) => [m.id, m]));
  const series = members.map((m) => ({ key: m.id, name: m.name, color: m.color }));
  const maxSys = Math.max(1, ...r.systems.map((s) => s.minutes));

  if (r.totalTasks === 0) {
    return (
      <div>
        <PageHeader title="Household Rhythms" sub="How your home actually runs, over time." />
        <Empty emoji="🌱" title="Rhythms appear after a week or two" body="As your household completes tasks, Better Together will surface patterns: busy days, who leads which systems, and where work piles up." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={`${formatDay(r.from, { month: "short", day: "numeric" })} – ${formatDay(r.to, { month: "short", day: "numeric" })} · last ${r.weeks} weeks`}
        title="Household Rhythms"
        sub={<>How your home actually runs: <b className="text-charcoal">{r.totalTasks}</b> things done, <b className="text-charcoal">{formatMinutes(r.totalMinutes)}</b> of shared effort.</>}
      />

      {/* Insights */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {r.insights.map((ins) => {
          const t = TONE[ins.tone];
          return (
            <div key={ins.title} className="card flex gap-3 p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: t.bg, color: t.fg }}>
                <t.Icon size={19} />
              </span>
              <div>
                <p className="font-bold leading-snug">{ins.title}</p>
                <p className="mt-1 text-sm text-ink-2">{ins.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Typical week */}
        <section className="card p-6">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">A typical week</h2>
            <Legend series={series} />
          </div>
          <p className="mb-5 text-sm text-ink-2">Average things done on each day of the week.</p>
          <StackedColumns
            data={r.typicalWeek.map((d) => ({ label: d.label, values: d.byMember, sub: `${d.label} · ~${formatMinutes(d.minutes)} of work` }))}
            series={series}
            format={(v) => (v >= 10 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, ""))}
            unit=" / wk"
          />
        </section>

        {/* Fair share */}
        <section className="card p-6">
          <h2 className="text-lg font-bold">Fair share check</h2>
          <p className="mb-5 text-sm text-ink-2">Fair isn&apos;t 50/50 — it&apos;s work in proportion to the time each person actually has.</p>
          <ul className="space-y-5">
            {r.fairness.map((f) => {
              const m = byId.get(f.id)!;
              const gap = f.minutesShare - f.capacityShare;
              return (
                <li key={f.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <Avatar m={m} size={28} />
                    <span className="font-bold">{m.name}</span>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${gap > 0.08 ? "bg-coral/15 text-coral-deep" : gap < -0.08 ? "bg-mustard-soft text-[#B07A10]" : "bg-sage-soft text-sage-deep"}`}>
                      {gap > 0.08 ? "Carrying extra" : gap < -0.08 ? "Has room" : "Balanced"}
                    </span>
                  </div>
                  <div className="grid grid-cols-[88px_1fr_40px] items-center gap-x-2 gap-y-1.5 text-xs">
                    <span className="text-ink-2">Did the work</span>
                    <div className="h-2.5 rounded-full bg-sand"><div className="h-full rounded-full" style={{ width: `${f.minutesShare * 100}%`, background: m.color }} /></div>
                    <span className="text-right font-bold tabular-nums">{Math.round(f.minutesShare * 100)}%</span>
                    <span className="text-ink-2">Has the time</span>
                    <div className="h-2.5 rounded-full bg-sand"><div className="h-full rounded-full bg-ink-3/60" style={{ width: `${f.capacityShare * 100}%` }} /></div>
                    <span className="text-right font-bold tabular-nums">{Math.round(f.capacityShare * 100)}%</span>
                    <span className="text-ink-2">Mental load</span>
                    <div className="h-2.5 rounded-full bg-sand"><div className="h-full rounded-full bg-plum/70" style={{ width: `${f.heavyShare * 100}%` }} /></div>
                    <span className="text-right font-bold tabular-nums">{Math.round(f.heavyShare * 100)}%</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Systems */}
      <section className="card mt-4 p-6">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">Where the work goes &amp; who leads it</h2>
          <Legend series={series} />
        </div>
        <p className="mb-5 text-sm text-ink-2">Time spent in each household system, split by who did it.</p>
        <div className="mb-6">
          <ShareBar height={18} parts={r.pillars.map((p) => ({ key: p.id, name: PILLARS[p.id].name, value: p.minutes, color: PILLARS[p.id].color }))} />
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            {r.pillars.map((p) => (
              <div key={p.id}>
                <p className="flex items-center gap-1.5 font-bold"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: PILLARS[p.id].color }} />{PILLARS[p.id].name}</p>
                <p className="text-ink-2">{Math.round(p.share * 100)}% · {formatMinutes(p.minutes)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-x-10 gap-y-6 lg:grid-cols-3">
          {PILLAR_ORDER.map((pid) => (
            <div key={pid}>
              <p className="eyebrow mb-3" style={{ color: PILLARS[pid].color }}>{PILLARS[pid].name}</p>
              <ul className="space-y-3.5">
                {r.systems.filter((s) => systemOf(s.id).pillar === pid).map((s) => {
                  const lead = byId.get(s.leadId ?? "");
                  return (
                    <li key={s.id}>
                      <div className="mb-1 flex items-center gap-2 text-sm">
                        <span>{systemOf(s.id).icon}</span>
                        <span className="font-semibold">{systemOf(s.id).short}</span>
                        <span className="ml-auto text-xs text-ink-2 tabular-nums">{s.count ? `${formatMinutes(s.minutes)} · ${s.count}×` : "—"}</span>
                      </div>
                      <div style={{ width: `${Math.max(6, (s.minutes / maxSys) * 100)}%` }}>
                        <ShareBar height={10} parts={members.map((m) => ({ key: m.id, name: m.name, value: s.byMember[m.id] ?? 0, color: m.color }))} />
                      </div>
                      {lead && s.count > 0 && (
                        <p className="mt-1 text-[11px] text-ink-2">
                          Led by <b className="text-charcoal">{lead.name}</b> ({Math.round(s.leadShare * 100)}%)
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Routines */}
        <section className="card p-6">
          <h2 className="text-lg font-bold">Routines on autopilot</h2>
          <p className="mb-4 text-sm text-ink-2">Recurring work and who it naturally flows to. New instances keep going to the usual owner.</p>
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-2">
                  <th className="px-2 pb-2 font-semibold">Routine</th>
                  <th className="px-2 pb-2 font-semibold">Repeats</th>
                  <th className="px-2 pb-2 font-semibold">Usually</th>
                  <th className="px-2 pb-2 text-right font-semibold">Avg time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {r.routines.slice(0, 14).map((rt) => {
                  const m = byId.get(rt.usualOwnerId);
                  return (
                    <tr key={rt.key}>
                      <td className="px-2 py-2.5">
                        <span className="mr-1.5">{systemOf(rt.system).icon}</span>
                        <span className="font-semibold">{rt.title}</span>
                      </td>
                      <td className="px-2 py-2.5 text-ink-2 capitalize">{rt.frequency}</td>
                      <td className="px-2 py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar m={m} size={22} /> {m?.name ?? "—"} <span className="text-xs text-ink-3">{Math.round(rt.ownerShare * 100)}%</span>
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-ink-2">{formatMinutes(rt.avgMinutes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Weekly trend */}
        <section className="card p-6">
          <h2 className="text-lg font-bold">Week over week</h2>
          <p className="mb-5 text-sm text-ink-2">Hours of household work completed each week.</p>
          <StackedColumns
            data={r.weeklyTotals.map((w) => ({ label: formatDay(w.start, { month: "numeric", day: "numeric" }), values: { all: w.minutes / 60 }, sub: `Week of ${formatDay(w.start, { month: "short", day: "numeric" })} · ${w.count} done` }))}
            series={[{ key: "all", name: "Hours", color: "var(--coral)" }]}
            format={(v) => (v >= 10 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, ""))}
            unit="h"
          />
        </section>
      </div>
    </div>
  );
}
