import { AlertTriangle, ArrowDown, Brain, Clock, Minus, Repeat, type LucideIcon } from "lucide-react";
import type { PublicMember } from "@/lib/auth";
import { formatMinutes } from "@/lib/dates";
import { pillarOf, systemOf } from "@/lib/systems";
import type { CognitiveLoad, Frequency, Priority, SystemId } from "@/lib/types";

export type MemberLite = Pick<PublicMember, "id" | "name" | "emoji" | "color" | "role">;

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export function Avatar({ m, size = 32, ring = false }: { m: MemberLite | undefined; size?: number; ring?: boolean }) {
  if (!m) {
    return (
      <span className="inline-grid place-items-center rounded-full bg-sand text-ink-3" style={{ width: size, height: size, fontSize: size * 0.45 }}>
        ?
      </span>
    );
  }
  return (
    <span
      title={m.name}
      className={cx("inline-grid shrink-0 place-items-center rounded-full", ring && "ring-2 ring-white")}
      style={{ width: size, height: size, background: `${m.color}22`, boxShadow: `inset 0 0 0 2px ${m.color}`, fontSize: size * 0.5 }}
    >
      <span aria-hidden>{m.emoji}</span>
    </span>
  );
}

export function SystemChip({ system, size = "sm" }: { system: SystemId; size?: "sm" | "xs" }) {
  const s = systemOf(system);
  const p = pillarOf(system);
  return (
    <span
      className={cx("inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap", size === "sm" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]")}
      style={{ background: p.soft, color: "var(--charcoal)" }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
      {s.short}
    </span>
  );
}

const PRI: Record<Priority, { label: string; cls: string; Icon: typeof AlertTriangle }> = {
  high: { label: "High", cls: "text-coral-deep", Icon: AlertTriangle },
  medium: { label: "Medium", cls: "text-[#B07A10]", Icon: Minus },
  low: { label: "Low", cls: "text-ink-2", Icon: ArrowDown },
};

export function PriorityTag({ p }: { p: Priority }) {
  const { label, cls, Icon } = PRI[p];
  return (
    <span className={cx("inline-flex items-center gap-1 text-xs font-bold", cls)}>
      <Icon size={14} strokeWidth={2.4} />
      {label}
    </span>
  );
}

const LOAD_LABEL: Record<CognitiveLoad, string> = { light: "Light lift", moderate: "Some thinking", heavy: "Brain-heavy" };
export function LoadTag({ load }: { load: CognitiveLoad }) {
  const n = load === "light" ? 1 : load === "moderate" ? 2 : 3;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2" title={`Cognitive load: ${LOAD_LABEL[load]}`}>
      <Brain size={14} />
      <span className="flex gap-0.5" aria-label={LOAD_LABEL[load]}>
        {[1, 2, 3].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i <= n ? "var(--plum)" : "var(--sand-deep)" }} />
        ))}
      </span>
      <span className="hidden sm:inline">{LOAD_LABEL[load]}</span>
    </span>
  );
}

/** Recurring-task marker: repeat icon + cadence (daily, weekly, biweekly, monthly). */
export function RepeatTag({ frequency }: { frequency: Frequency | null }) {
  if (!frequency) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2 capitalize" title={`Repeats ${frequency}`}>
      <Repeat size={13} /> {frequency}
    </span>
  );
}

export function TimePill({ minutes }: { minutes: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-1 text-xs font-bold text-charcoal">
      <Clock size={12} strokeWidth={2.6} />
      {formatMinutes(minutes)}
    </span>
  );
}

export function PageHeader({ eyebrow, title, sub, right }: { eyebrow?: string; title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-sm text-ink-2">{eyebrow}</p>}
        <h1 className="text-3xl font-bold text-charcoal sm:text-4xl">{title}</h1>
        {sub && <div className="mt-1.5 text-[15px] text-ink-2">{sub}</div>}
      </div>
      {right}
    </header>
  );
}

export function Empty({ icon: Icon, title, body, children }: { icon: LucideIcon; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-sand text-ink-2">
        <Icon size={26} strokeWidth={1.8} />
      </span>
      <p className="font-bold text-charcoal">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-2">{body}</p>}
      {children}
    </div>
  );
}
