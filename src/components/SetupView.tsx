"use client";

import { Check, Plus, RotateCcw, Sparkles, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PublicMember } from "@/lib/auth";
import { formatMinutes, MON_FIRST, WEEKDAY_SHORT } from "@/lib/dates";
import { MEMBER_COLORS, MEMBER_EMOJI, PILLAR_ORDER, PILLARS, SYSTEMS } from "@/lib/systems";
import type { SystemId } from "@/lib/types";
import { Avatar, cx, PageHeader } from "./ui";

type Editable = Omit<PublicMember, "id" | "username"> & { id?: string; username: string; password: string };

const blank = (i: number): Editable => ({
  name: "", username: "", password: "", role: "member", color: MEMBER_COLORS[i % MEMBER_COLORS.length], emoji: MEMBER_EMOJI[i % MEMBER_EMOJI.length],
  dailyTaskLimit: 4, schedule: [120, 60, 60, 60, 60, 60, 120], preferredSystems: [], notes: "",
});

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save");
}

const field = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral focus:ring-4 focus:ring-coral/10";

export function SetupView({ household, members, meId, status }: {
  household: { id: string; name: string; timezone: string };
  members: PublicMember[];
  meId: string;
  status: { claude: boolean; store: "supabase" | "upstash" | "file"; learned: number };
}) {
  const router = useRouter();
  const [name, setName] = useState(household.name);
  const [tz, setTz] = useState(household.timezone);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveHousehold() {
    try {
      await call("/api/household", "PUT", { name, timezone: tz });
      setMsg({ ok: true, text: "Household saved." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  const timezones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [household.timezone];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Household Setup" sub="Who's in, how much they can take on, and what they love owning." />

      <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className={cx("inline-flex items-center gap-1 rounded-full px-3 py-1", status.claude ? "bg-sage-soft text-sage-deep" : "bg-mustard-soft text-[#B07A10]")}>
          {status.claude && <Sparkles size={12} />}
          {status.claude ? "Claude connected" : "Offline rules (no ANTHROPIC_API_KEY)"}
        </span>
        <span className={cx("rounded-full px-3 py-1", status.store !== "file" ? "bg-sage-soft text-sage-deep" : "bg-sand text-ink-2")}>
          {status.store === "supabase" ? "Cloud storage · Supabase" : status.store === "upstash" ? "Cloud storage · Upstash" : "Local file storage"}
        </span>
        <span className="rounded-full bg-sand px-3 py-1 text-ink-2">{status.learned} assignment preference{status.learned === 1 ? "" : "s"} learned</span>
      </div>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-bold">Household</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-xs font-bold text-ink-2">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold text-ink-2">Timezone</span>
            <select value={tz} onChange={(e) => setTz(e.target.value)} className={field}>
              {timezones.map((z) => <option key={z}>{z}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={saveHousehold} className="rounded-xl bg-coral px-4 py-2 text-sm font-bold text-white hover:bg-coral-deep">Save</button>
          {household.id === "demo" && (
            <button
              onClick={async () => {
                if (!confirm("Reset the demo household? All demo tasks and members go back to their starting state.")) return;
                await call("/api/household/reset", "POST");
                router.refresh();
                setMsg({ ok: true, text: "Demo data refreshed for today." });
              }}
              className="flex items-center gap-1.5 rounded-xl bg-sand px-4 py-2 text-sm font-bold hover:bg-sand-deep"
            >
              <RotateCcw size={15} /> Reset demo data
            </button>
          )}
          {msg && <span className={cx("text-sm font-semibold", msg.ok ? "text-sage-deep" : "text-coral-deep")}>{msg.text}</span>}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Members · {members.length}</h2>
          {!adding && (
            <button onClick={() => { setAdding(true); setEditing(null); }} className="flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm font-bold text-white hover:bg-coral-deep">
              <UserPlus size={16} /> Add member
            </button>
          )}
        </div>
        <div className="space-y-3">
          {adding && (
            <MemberForm
              initial={blank(members.length)}
              isNew
              onCancel={() => setAdding(false)}
              onSave={async (m) => {
                await call("/api/members", "POST", m);
                setAdding(false);
                router.refresh();
              }}
            />
          )}
          {members.map((m) =>
            editing === m.id ? (
              <MemberForm
                key={m.id}
                initial={{ ...m, password: "" }}
                self={m.id === meId}
                onCancel={() => setEditing(null)}
                onSave={async (x) => {
                  const { username: _u, id: _id, ...rest } = x;
                  await call(`/api/members/${m.id}`, "PATCH", rest);
                  setEditing(null);
                  router.refresh();
                }}
                onDelete={m.id === meId ? undefined : async () => {
                  if (!confirm(`Remove ${m.name}? Their open tasks will move to you.`)) return;
                  await call(`/api/members/${m.id}`, "DELETE");
                  setEditing(null);
                  router.refresh();
                }}
              />
            ) : (
              <button key={m.id} onClick={() => { setEditing(m.id); setAdding(false); }} className="card flex w-full items-center gap-4 p-4 text-left transition hover:border-coral">
                <Avatar m={m} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {m.name} <span className="ml-1 text-xs font-semibold text-ink-3">@{m.username}</span>
                    {m.role === "admin" && <span className="ml-2 rounded-full bg-coral/15 px-2 py-0.5 text-[11px] font-bold text-coral-deep">Admin</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-2">
                    Up to {m.dailyTaskLimit} things a day · {formatMinutes(m.schedule.reduce((a, b) => a + b, 0))} a week
                    {m.preferredSystems.length > 0 && ` · Likes ${m.preferredSystems.map((s) => SYSTEMS.find((x) => x.id === s)?.short).join(", ")}`}
                  </p>
                </div>
                <span className="text-sm font-bold text-ink-3">Edit</span>
              </button>
            ),
          )}
        </div>
      </section>
    </div>
  );
}

function MemberForm({ initial, isNew, self, onSave, onCancel, onDelete }: {
  initial: Editable;
  isNew?: boolean;
  self?: boolean;
  onSave: (m: Editable) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [m, setM] = useState<Editable>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Editable>) => setM((x) => ({ ...x, ...p }));
  const toggleSys = (id: SystemId) => set({ preferredSystems: m.preferredSystems.includes(id) ? m.preferredSystems.filter((s) => s !== id) : [...m.preferredSystems, id] });

  return (
    <form
      className="card animate-rise space-y-5 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSave(m);
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <div className="flex items-center gap-3">
        <Avatar m={{ ...m, id: m.id ?? "new" }} size={48} />
        <p className="text-lg font-bold">{isNew ? "New member" : `Edit ${initial.name}`}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs font-bold text-ink-2">Name</span>
          <input value={m.name} onChange={(e) => set({ name: e.target.value })} className={field} required />
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold text-ink-2">Role</span>
          <select value={m.role} onChange={(e) => set({ role: e.target.value as Editable["role"] })} className={field} disabled={self}>
            <option value="member">Member — sees their own day + shared views</option>
            <option value="admin">Admin — sees everyone, manages the household</option>
          </select>
        </label>
        {isNew && (
          <label>
            <span className="mb-1 block text-xs font-bold text-ink-2">Username</span>
            <input value={m.username} onChange={(e) => set({ username: e.target.value.toLowerCase() })} className={field} autoCapitalize="none" required />
          </label>
        )}
        <label>
          <span className="mb-1 block text-xs font-bold text-ink-2">{isNew ? "Password" : "New password (optional)"}</span>
          <input type="password" value={m.password} onChange={(e) => set({ password: e.target.value })} className={field} required={isNew} minLength={8} autoComplete="new-password" />
        </label>
      </div>

      <div className="flex flex-wrap gap-6">
        <div>
          <span className="mb-1.5 block text-xs font-bold text-ink-2">Emoji</span>
          <div className="flex flex-wrap gap-1">
            {MEMBER_EMOJI.map((e) => (
              <button type="button" key={e} onClick={() => set({ emoji: e })} className={cx("grid h-9 w-9 place-items-center rounded-full text-lg", m.emoji === e ? "bg-sand ring-2 ring-coral" : "hover:bg-sand")}>{e}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-bold text-ink-2">Color</span>
          <div className="flex gap-1.5">
            {MEMBER_COLORS.map((c) => (
              <button type="button" key={c} onClick={() => set({ color: c })} className="grid h-9 w-9 place-items-center rounded-full" style={{ background: c }} aria-label={c}>
                {m.color === c && <Check size={16} className="text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-bold text-ink-2">Daily task limit — how many things on their My Day</span>
        <div className="flex gap-2">
          {[3, 4, 5].map((n) => (
            <button type="button" key={n} onClick={() => set({ dailyTaskLimit: n })} className={cx("h-10 w-14 rounded-xl text-sm font-bold", m.dailyTaskLimit === n ? "bg-coral text-white" : "bg-sand")}>{n}</button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-bold text-ink-2">Typical weekly schedule — minutes available for household stuff</span>
        <div className="grid grid-cols-7 gap-1.5">
          {MON_FIRST.map((wd) => (
            <label key={wd} className="text-center">
              <span className="mb-1 block text-[11px] font-bold text-ink-2">{WEEKDAY_SHORT[wd]}</span>
              <input
                type="number"
                min={0}
                max={960}
                step={15}
                value={m.schedule[wd]}
                onChange={(e) => {
                  const s = [...m.schedule] as Editable["schedule"];
                  s[wd] = Math.max(0, Math.min(960, Number(e.target.value) || 0));
                  set({ schedule: s });
                }}
                className="w-full rounded-lg border border-line bg-white px-1 py-2 text-center text-sm tabular-nums"
              />
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-3">≈ {formatMinutes(m.schedule.reduce((a, b) => a + b, 0))} per week. Used to keep assignments fair to each person&apos;s real bandwidth.</p>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-bold text-ink-2">Likes owning</span>
        <div className="space-y-2">
          {PILLAR_ORDER.map((p) => (
            <div key={p} className="flex flex-wrap gap-1.5">
              {SYSTEMS.filter((s) => s.pillar === p).map((s) => {
                const on = m.preferredSystems.includes(s.id);
                return (
                  <button type="button" key={s.id} onClick={() => toggleSys(s.id)} className="rounded-full border px-3 py-2 text-xs font-semibold transition"
                    style={on ? { background: PILLARS[p].color, borderColor: PILLARS[p].color, color: "white" } : { borderColor: "var(--line)", background: "white" }}>
                    {s.short}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-bold text-ink-2">Notes for assignment (age, constraints, preferences)</span>
        <textarea value={m.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} className={field} placeholder="e.g. 12 years old — no driving tasks. Travels for work most Thursdays." />
      </label>

      {error && <p className="rounded-xl bg-coral/10 px-3 py-2 text-sm font-semibold text-coral-deep">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-coral px-5 py-2.5 text-sm font-bold text-white hover:bg-coral-deep disabled:opacity-60">
          {isNew ? <Plus size={16} /> : <Check size={16} />} {isNew ? "Add to household" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-bold text-ink-2 hover:bg-sand">Cancel</button>
        {onDelete && (
          <button type="button" onClick={onDelete} className="ml-auto flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold text-coral-deep hover:bg-coral/10">
            <Trash2 size={15} /> Remove
          </button>
        )}
      </div>
    </form>
  );
}
