import { cx } from "./ui";

export interface Series {
  key: string;
  name: string;
  color: string;
}

/** Legend: always present for 2+ series; identity is never color-alone. */
export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink-2">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/**
 * Stacked columns (e.g. completions per weekday by member). Thin bars, 4px rounded top,
 * 2px surface gaps between segments, hover tooltip per column, value on the cap.
 */
export function StackedColumns({
  data,
  series,
  height = 160,
  format = (v: number) => String(Math.round(v)),
  unit = "",
}: {
  data: { label: string; values: Record<string, number>; highlight?: boolean; sub?: string }[];
  series: Series[];
  height?: number;
  format?: (v: number) => string;
  unit?: string;
}) {
  const totals = data.map((d) => series.reduce((s, x) => s + (d.values[x.key] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  return (
    <div>
      <div className="relative flex" style={{ height: height + 20 }}>
        {/* y ticks + recessive gridlines */}
        <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height }}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: (t / top) * height - 6 }}>
              <span className="w-6 text-right text-[10px] tabular-nums text-ink-3">{format(t)}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
          ))}
        </div>
        <div className="ml-8 flex flex-1 items-end justify-around">
          {data.map((d, i) => (
            <div key={d.label} tabIndex={0} aria-label={d.sub ?? d.label} className="group relative flex h-full flex-1 flex-col items-center justify-end rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-coral/40">
              <div className="flex flex-col-reverse items-center gap-[2px]" style={{ height, justifyContent: "flex-start" }}>
                {series.map((s, si) => {
                  const v = d.values[s.key] ?? 0;
                  if (!v) return null;
                  const isTop = series.slice(si + 1).every((x) => !(d.values[x.key] ?? 0));
                  return (
                    <span
                      key={s.key}
                      className={cx("block w-[22px] transition-opacity group-hover:opacity-90", isTop && "rounded-t-[4px]")}
                      style={{ height: Math.max(2, (v / top) * height - 2), background: s.color }}
                    />
                  );
                })}
              </div>
              {totals[i] > 0 && (
                <span className="absolute text-[11px] font-bold tabular-nums text-charcoal" style={{ bottom: (totals[i] / top) * height + 22 }}>
                  {format(totals[i])}
                </span>
              )}
              <span className={cx("mt-1.5 text-xs font-semibold", d.highlight ? "rounded-full bg-coral px-1.5 text-white" : "text-ink-2")}>{d.label}</span>
              {/* hover tooltip */}
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden min-w-32 rounded-xl bg-charcoal px-3 py-2 text-xs text-white shadow-lg group-hover:block group-focus:block">
                <p className="mb-1 font-bold">{d.sub ?? d.label}</p>
                {series.map((s) => (
                  <p key={s.key} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                    <span className="tabular-nums">
                      {format(d.values[s.key] ?? 0)}
                      {unit}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function niceStep(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** Single-value progress ring — a hero number, not a chart. */
export function Ring({ pct, size = 132, stroke = 12, color = "var(--sage)", children }: { pct: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sand)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct / 100))} style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** 100% horizontal stack with 2px gaps; labels outside when segments are narrow. */
export function ShareBar({ parts, height = 14 }: { parts: { key: string; name: string; value: number; color: string }[]; height?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="flex w-full gap-[2px] overflow-hidden rounded-full bg-sand" style={{ height }}>
      {parts.filter((p) => p.value > 0).map((p) => (
        <span key={p.key} title={`${p.name}: ${Math.round((p.value / total) * 100)}%`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
      ))}
    </div>
  );
}
