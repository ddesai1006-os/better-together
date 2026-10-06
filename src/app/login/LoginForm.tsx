"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cx } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const body = mode === "signup" ? { ...form, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } : form;
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Something went wrong");
      setBusy(false);
    }
  }

  const input = "w-full rounded-2xl border border-line bg-white px-4 py-3 text-[15px] outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/15";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/logo.png" alt="Better Together" width={232} height={73} priority className="mix-blend-multiply" />
          <p className="mt-4 text-ink-2">Less mental load. More &ldquo;we&rdquo;.</p>
        </div>

        <div className="card p-6">
          <div className="mb-5 grid grid-cols-2 rounded-full bg-sand p-1 text-sm font-bold">
            {(["login", "signup"] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
                className={cx("rounded-full py-2 transition", mode === m ? "bg-white text-charcoal shadow-sm" : "text-ink-2")}>
                {m === "login" ? "Sign in" : "New household"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <>
                <input name="householdName" placeholder="Household name (e.g. The Parkers)" className={input} required />
                <input name="name" placeholder="Your first name" className={input} required />
              </>
            )}
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink-2">Username</span>
              <input name="username" autoComplete="username" autoCapitalize="none" className={input} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink-2">Password</span>
              <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className={input} required />
            </label>
            {error && <p className="rounded-xl bg-coral/10 px-3 py-2 text-sm font-semibold text-coral-deep">{error}</p>}
            <button disabled={busy} className="w-full rounded-2xl bg-coral py-3.5 font-bold text-white shadow-sm transition hover:bg-coral-deep disabled:opacity-60">
              {busy ? "One sec…" : mode === "login" ? "Sign in" : "Create household"}
            </button>
          </form>
        </div>

        {mode === "login" && (
          <div className="mt-5 rounded-2xl border border-dashed border-sand-deep px-4 py-3 text-center text-sm text-ink-2">
            <p className="font-semibold text-charcoal">Try the demo household</p>
            <p>
              <code className="font-bold">maya</code> (admin) · <code className="font-bold">sam</code> · <code className="font-bold">leo</code> — password <code className="font-bold">together</code>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
