"use client";

import { ArrowLeft, Check, Copy, KeyRound, Mic } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cx, PageHeader } from "./ui";

function CopyField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="mb-1 text-xs font-bold text-ink-2">{label}</p>
      <div className="flex items-center gap-2">
        <code className={cx("min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] break-all", secret && "font-semibold text-charcoal")}>{value}</code>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-sand px-3 text-xs font-bold hover:bg-sand-deep"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function SiriSetup({ endpoint, hasKey, keyCreatedAt }: { endpoint: string; hasKey: boolean; keyCreatedAt: string | null }) {
  const router = useRouter();
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);

  async function makeKey() {
    if (hasKey && !confirm("Make a new key? Your current Siri Shortcut will stop working until you paste the new key into it.")) return;
    setBusy(true);
    const res = await fetch("/api/me/key", { method: "POST" });
    const j = await res.json();
    setKey(j.key ?? null);
    setTest(null);
    setBusy(false);
    router.refresh();
  }

  async function turnOff() {
    if (!confirm("Turn off your Siri key? The shortcut will stop sending to Better Together.")) return;
    await fetch("/api/me/key", { method: "DELETE" });
    setKey(null);
    router.refresh();
  }

  async function sendTest() {
    if (!key) return;
    setTest(null);
    const res = await fetch("/api/inbox", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Test from Siri setup — remember to buy batteries for the smoke detector" }),
    });
    const j = await res.json().catch(() => ({}));
    setTest({ ok: res.ok, text: res.ok ? "It worked — check To review on Brain Dump." : (j.message ?? "That didn't work.") });
  }

  const step = "flex gap-3";
  const num = "grid h-7 w-7 shrink-0 place-items-center rounded-full bg-coral text-xs font-bold text-white";

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/" className="-ml-2 mb-3 inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-sm font-bold text-ink-2 hover:bg-sand hover:text-charcoal">
        <ArrowLeft size={16} /> Brain Dump
      </Link>
      <PageHeader
        title="Brain dump with Siri"
        sub={<>Say &ldquo;Hey Siri, Brain Dump,&rdquo; then talk. What you say lands in <b className="text-charcoal">To review</b> for the household to look over — nothing is assigned until someone reviews it.</>}
      />

      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <KeyRound size={18} className="text-ink-2" /> 1. Your personal key
        </h2>
        <p className="mt-1 text-sm text-ink-2">It tells Better Together the message is from you. Keep it private — anyone with it can add to your household&apos;s inbox.</p>

        {key ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl bg-mustard-soft px-3 py-2 text-sm text-charcoal">Copy it now — for your security it won&apos;t be shown again.</p>
            <CopyField label="Your key" value={key} secret />
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={sendTest} className="rounded-full bg-sand px-4 py-2.5 text-sm font-bold hover:bg-sand-deep">
                Send a test message
              </button>
              {test && <span className={cx("text-sm font-semibold", test.ok ? "text-sage-deep" : "text-coral-deep")}>{test.text}</span>}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={makeKey} disabled={busy} className="rounded-full bg-coral px-4 py-2.5 text-sm font-bold text-white hover:bg-coral-deep disabled:opacity-60">
              {hasKey ? "Make a new key" : "Make my key"}
            </button>
            {hasKey && (
              <>
                <span className="text-sm text-ink-2">
                  You have a key{keyCreatedAt ? ` from ${new Date(keyCreatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}.
                </span>
                <button onClick={turnOff} className="rounded-full px-3 py-2 text-sm font-bold text-coral-deep hover:bg-coral/10">
                  Turn off
                </button>
              </>
            )}
          </div>
        )}
      </section>

      <section className="card mt-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Mic size={18} className="text-ink-2" /> 2. Make the shortcut on your iPhone
        </h2>
        <p className="mt-1 text-sm text-ink-2">About 3 minutes, once. Open the <b>Shortcuts</b> app (it comes with every iPhone).</p>

        <div className="mt-4">
          <CopyField label="Web address to paste in step 3" value={endpoint} />
        </div>

        <ol className="mt-5 space-y-4 text-[15px]">
          <li className={step}>
            <span className={num}>1</span>
            <p>
              Tap <b>+</b> (top right) to make a new shortcut. Tap its name at the top and rename it <b>Brain Dump</b> — that&apos;s what you&apos;ll say to Siri.
            </p>
          </li>
          <li className={step}>
            <span className={num}>2</span>
            <p>
              Tap <b>Add Action</b>, search for <b>Dictate Text</b>, and add it.
            </p>
          </li>
          <li className={step}>
            <span className={num}>3</span>
            <div>
              <p>
                Search for <b>Get Contents of URL</b> and add it. Tap <b>URL</b> and paste the web address above. Then tap the small arrow to show more options and set:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
                <li>
                  <b className="text-charcoal">Method:</b> POST
                </li>
                <li>
                  <b className="text-charcoal">Headers:</b> add one — Key <code>Authorization</code>, Value <code>Bearer </code> followed by your key (with a space after Bearer)
                </li>
                <li>
                  <b className="text-charcoal">Request Body:</b> JSON — add a <b>Text</b> field with Key <code>text</code>, and for its value tap <b>Dictated Text</b> from the suggestions above the keyboard
                </li>
              </ul>
            </div>
          </li>
          <li className={step}>
            <span className={num}>4</span>
            <p>
              Optional, so Siri confirms out loud: add <b>Get Dictionary Value</b> (Key: <code>message</code>), then <b>Speak Text</b>.
            </p>
          </li>
          <li className={step}>
            <span className={num}>5</span>
            <p>
              Tap <b>Done</b>. Now try: <b>&ldquo;Hey Siri, Brain Dump&rdquo;</b>, then say what&apos;s on your mind. It&apos;ll be waiting in <b>To review</b> on Brain Dump.
            </p>
          </li>
        </ol>
        <p className="mt-5 rounded-xl bg-offwhite px-3 py-2 text-xs text-ink-2">
          Works on iPhone and iPad, and may also run from Apple Watch or HomePod depending on your setup. Android, Google Home and Alexa aren&apos;t supported yet.
        </p>
      </section>
    </div>
  );
}
