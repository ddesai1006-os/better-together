"use client";

import { ArrowRight, Camera, Check, ImagePlus, Lightbulb, Mic, MicOff, PenLine, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PublicMember } from "@/lib/auth";
import { formatMinutes } from "@/lib/dates";
import type { DumpResult } from "@/lib/types";
import { ReviewList, type Draft } from "./ReviewList";
import { cx, SystemChip } from "./ui";

type Mode = "text" | "photo" | "voice";
type Phase = "compose" | "thinking" | "review" | "sent";
interface Img { mediaType: "image/jpeg"; data: string; preview: string }

const EXAMPLES = [
  "Fridge is basically empty, Leo's field trip form is due Thursday, and we should finally plan something fun for the long weekend",
  "Car is making a weird noise again. Also water bill came, and Grandma's birthday is the 14th",
  "Need someone to do laundry every Sunday. Dentist for everyone this month?",
];

const THINKING = [
  "Reading between the lines…",
  "Sorting into household systems…",
  "Checking who has room this week…",
  "Weighing what's urgent…",
  "Making it feel fair…",
];

async function downscale(file: File): Promise<Img> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  const scale = Math.min(1, 1568 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: dataUrl.split(",")[1], preview: dataUrl };
}

// Minimal typing for the Web Speech API (not in lib.dom for all browsers).
interface SpeechRec {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

export function BrainDump(props: {
  greeting: string;
  me: PublicMember;
  members: PublicMember[];
  todayCount: number;
  todayMinutes: number;
  ideas: { id: string; title: string; system: Parameters<typeof SystemChip>[0]["system"]; context: string }[];
  aiReady: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("text");
  const [phase, setPhase] = useState<Phase>("compose");
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [images, setImages] = useState<Img[]>([]);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DumpResult | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sentSummary, setSentSummary] = useState<{ total: number; byMember: Record<string, number>; ideas: number } | null>(null);
  const [tick, setTick] = useState(0);
  const recRef = useRef<SpeechRec | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase !== "thinking") return;
    const id = setInterval(() => setTick((t) => t + 1), 1800);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => () => recRef.current?.stop(), []);

  function toggleVoice() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return setVoiceSupported(false);
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e) => {
      let finalText = "";
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else live += r[0].transcript;
      }
      if (finalText) setText((t) => (t ? `${t.trimEnd()} ` : "") + finalText.trim());
      setInterim(live);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setError("Microphone access was blocked — allow it in your browser to dictate.");
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
    setError(null);
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const next = await Promise.all([...files].slice(0, 3 - images.length).map(downscale));
    setImages((imgs) => [...imgs, ...next].slice(0, 3));
  }

  async function interpret(clarifications?: { question: string; answer: string }[]) {
    recRef.current?.stop();
    setPhase("thinking");
    setError(null);
    try {
      const res = await fetch("/api/brain-dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          source: images.length ? "photo" : mode === "voice" ? "voice" : "text",
          images: images.map(({ mediaType, data }) => ({ mediaType, data })),
          clarifications,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      const r = json as DumpResult;
      setResult(r);
      setDrafts(r.proposals.map((p) => ({ ...p, assigneeId: p.suggestedAssigneeId, answer: "", include: true })));
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase(result ? "review" : "compose");
    }
  }

  async function send() {
    const items = drafts.filter((d) => d.include);
    if (!items.length) return;
    setError(null);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't save those");
      return;
    }
    const byMember: Record<string, number> = {};
    for (const d of items) if (d.kind !== "idea" && d.assigneeId) byMember[d.assigneeId] = (byMember[d.assigneeId] ?? 0) + 1;
    setSentSummary({ total: items.length, byMember, ideas: items.filter((d) => d.kind === "idea").length });
    setPhase("sent");
    router.refresh();
  }

  function reset() {
    setText("");
    setImages([]);
    setResult(null);
    setDrafts([]);
    setSentSummary(null);
    setPhase("compose");
  }

  async function activateIdea(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "activate" }) });
    router.refresh();
  }

  const canSubmit = text.trim().length > 0 || images.length > 0;

  // ------------------------------------------------------------------ Thinking
  if (phase === "thinking") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="animate-breathe mb-6 grid h-24 w-24 place-items-center rounded-full bg-coral/15">
          <Sparkles className="text-coral-deep" size={40} />
        </div>
        <p className="text-xl font-bold text-charcoal">{THINKING[tick % THINKING.length]}</p>
        <p className="mt-2 text-ink-2">You let it out. We&apos;ll take it from here.</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------- Sent
  if (phase === "sent" && sentSummary) {
    const names = props.members.filter((m) => sentSummary.byMember[m.id]);
    return (
      <div className="mx-auto max-w-xl">
        <div className="card animate-rise flex flex-col items-center px-6 py-10 text-center">
          <div className="animate-pop mb-4 grid h-20 w-20 place-items-center rounded-full bg-mustard shadow-md">
            <Check size={40} className="text-white" strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-bold">Out of your head, into the plan.</h2>
          <p className="mt-2 text-ink-2">
            {sentSummary.total} item{sentSummary.total === 1 ? "" : "s"} shared with the household
            {sentSummary.ideas ? ` (${sentSummary.ideas} parked as idea${sentSummary.ideas === 1 ? "" : "s"})` : ""}.
          </p>
          {names.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {names.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-2 rounded-full bg-sand px-3 py-1.5 text-sm font-semibold">
                  <span>{m.emoji}</span> {m.id === props.me.id ? "You" : m.name} · {sentSummary.byMember[m.id]}
                </span>
              ))}
            </div>
          )}
          <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row">
            <button onClick={reset} className="flex-1 rounded-2xl bg-sand py-3 font-bold text-charcoal hover:bg-sand-deep">
              Dump something else
            </button>
            <Link href="/day" className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-coral py-3 font-bold text-white hover:bg-coral-deep">
              See my day <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------- Review
  if (phase === "review" && result) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-coral/15">
            <Sparkles className="text-coral-deep" size={20} />
          </div>
          <div className="card rounded-tl-md px-4 py-3">
            <p className="font-semibold text-charcoal">{result.summary}</p>
            <p className="mt-1 text-sm text-ink-2">Tweak anything that&apos;s off, then send it to the household.</p>
          </div>
        </div>
        {result.engine === "offline" && (
          <p className="mb-4 rounded-xl bg-mustard-soft px-3 py-2 text-sm text-charcoal">
            Running in offline mode with simple rules. Add an <code>ANTHROPIC_API_KEY</code> to unlock Claude&apos;s full interpretation, photo reading, and smarter assignment.
          </p>
        )}
        <ReviewList drafts={drafts} setDrafts={setDrafts} members={props.members} meId={props.me.id} />
        {error && <p className="mt-4 rounded-xl bg-coral/10 px-3 py-2 text-sm font-semibold text-coral-deep">{error}</p>}
        <div className="sticky bottom-20 mt-6 flex flex-wrap gap-2 rounded-3xl bg-offwhite/90 py-2 backdrop-blur md:bottom-4">
          <button onClick={reset} className="rounded-2xl px-3 py-3 font-bold text-ink-2 hover:bg-sand">
            Start over
          </button>
          {drafts.some((d) => d.include && d.clarifyingQuestion && d.answer.trim()) && (
            <button
              onClick={() => interpret(drafts.filter((d) => d.clarifyingQuestion && d.answer.trim()).map((d) => ({ question: d.clarifyingQuestion!, answer: d.answer })))}
              className="flex items-center justify-center gap-2 rounded-2xl bg-mustard px-5 py-3 font-bold text-charcoal hover:brightness-95"
            >
              <Sparkles size={18} /> Re-think with my answers
            </button>
          )}
          <button
            onClick={send}
            disabled={!drafts.some((d) => d.include)}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-coral py-3 font-bold text-white shadow-sm hover:bg-coral-deep disabled:opacity-50"
          >
            Send to the household ({drafts.filter((d) => d.include).length}) <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------- Compose
  const tabs: { id: Mode; label: string; Icon: typeof PenLine }[] = [
    { id: "text", label: "Type", Icon: PenLine },
    { id: "photo", label: "Photo", Icon: Camera },
    { id: "voice", label: "Voice", Icon: Mic },
  ];

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section>
        <p className="mb-1 text-ink-2">{props.greeting} 👋</p>
        <h1 className="text-3xl font-bold sm:text-4xl">What&apos;s on your mind?</h1>
        <p className="mt-1.5 text-[15px] text-ink-2">Dump it here — messy is perfect. We&apos;ll sort, prioritize, and share it out.</p>

        <div className="mt-6 flex gap-2">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => {
                setMode(id);
                if (id === "voice") {
                  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
                  setVoiceSupported(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
                }
              }}
              className={cx(
                "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition",
                mode === id ? "bg-coral text-white shadow-sm" : "bg-sand text-charcoal hover:bg-sand-deep",
              )}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        <div className="card mt-4 overflow-hidden">
          {mode === "photo" && (
            <div className="border-b border-line p-4">
              <div className="flex flex-wrap gap-3">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.preview} alt="" className="h-24 w-24 rounded-xl object-cover" />
                    <button onClick={() => setImages((all) => all.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 rounded-full bg-charcoal p-1 text-white" aria-label="Remove photo">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {images.length < 3 && (
                  <>
                    <button onClick={() => cameraRef.current?.click()} className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-sand-deep text-xs font-semibold text-ink-2 hover:border-coral hover:text-coral-deep sm:hidden">
                      <Camera size={22} /> Camera
                    </button>
                    <button onClick={() => fileRef.current?.click()} className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-sand-deep text-xs font-semibold text-ink-2 hover:border-coral hover:text-coral-deep">
                      <ImagePlus size={22} /> Upload
                    </button>
                  </>
                )}
              </div>
              <p className="mt-3 text-xs text-ink-2">Snap a school flyer, a receipt, a whiteboard, or a fridge list. Add a note below if you like.</p>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.target.files)} />
            </div>
          )}

          {mode === "voice" && (
            <div className="flex flex-col items-center border-b border-line px-4 py-6">
              <button
                onClick={toggleVoice}
                disabled={!voiceSupported}
                className={cx(
                  "grid h-20 w-20 place-items-center rounded-full text-white shadow-md transition disabled:opacity-40",
                  listening ? "animate-breathe bg-coral-deep" : "bg-coral hover:bg-coral-deep",
                )}
                aria-label={listening ? "Stop dictation" : "Start dictation"}
              >
                {listening ? <MicOff size={32} /> : <Mic size={32} />}
              </button>
              <p className="mt-3 text-sm font-semibold text-ink-2">
                {!voiceSupported ? "Dictation isn't supported in this browser — try Chrome or Safari, or your keyboard's mic." : listening ? "Listening… tap to stop" : "Tap and just talk"}
              </p>
              {interim && <p className="mt-2 text-center text-sm text-ink-3 italic">{interim}</p>}
            </div>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) interpret();
            }}
            rows={mode === "text" ? 7 : 4}
            placeholder={mode === "photo" ? "Anything to add about the photo? (optional)" : mode === "voice" ? "Your words will appear here…" : "e.g. Need to grab groceries before Saturday, Leo's permission slip is due, the bathroom faucet is dripping again…"}
            className="block w-full resize-none bg-transparent px-5 py-4 text-[16px] leading-relaxed outline-none placeholder:text-ink-3"
          />
          <div className="flex items-center justify-between gap-3 border-t border-line bg-offwhite/60 px-4 py-3">
            <span className="text-xs text-ink-3">{props.aiReady ? "✨ Claude will organize this for you" : "Offline mode · simple rules"}</span>
            <button
              onClick={() => interpret()}
              disabled={!canSubmit}
              className="flex items-center gap-2 rounded-2xl bg-coral px-5 py-3 font-bold text-white shadow-sm transition hover:bg-coral-deep disabled:opacity-40"
            >
              <Sparkles size={18} /> Sort it out
            </button>
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl bg-coral/10 px-3 py-2 text-sm font-semibold text-coral-deep">{error}</p>}

        {!text && images.length === 0 && mode === "text" && (
          <div className="mt-5">
            <p className="eyebrow mb-2 flex items-center gap-1.5 text-[#B07A10]">
              <Sparkles size={14} /> Try something like
            </p>
            <div className="flex flex-col gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => setText(ex)} className="rounded-2xl bg-mustard-soft px-4 py-2.5 text-left text-sm text-charcoal transition hover:brightness-95">
                  &ldquo;{ex}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <Link href="/day" className="card group block p-5 transition hover:border-coral">
          <p className="eyebrow text-coral-deep">Your day</p>
          <p className="mt-2 text-2xl font-bold">
            {props.todayCount ? `${props.todayCount} thing${props.todayCount === 1 ? "" : "s"} to focus on` : "All clear today 🎉"}
          </p>
          {props.todayCount > 0 && <p className="mt-1 text-sm text-ink-2">About {formatMinutes(props.todayMinutes)} of work</p>}
          <p className="mt-3 flex items-center gap-1 text-sm font-bold text-coral-deep">
            Open My Day <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
          </p>
        </Link>

        {props.ideas.length > 0 && (
          <div className="card p-5">
            <p className="eyebrow mb-3 flex items-center gap-1.5 text-plum">
              <Lightbulb size={14} /> Parked ideas
            </p>
            <ul className="space-y-3">
              {props.ideas.map((idea) => (
                <li key={idea.id} className="group">
                  <p className="text-sm font-semibold">{idea.title}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <SystemChip system={idea.system} size="xs" />
                    <span className="flex gap-1 opacity-80 group-hover:opacity-100">
                      <button onClick={() => activateIdea(idea.id)} className="rounded-full px-2 py-0.5 text-xs font-bold text-sage-deep hover:bg-sage-soft">
                        I&apos;ll do it
                      </button>
                      <button
                        onClick={async () => {
                          await fetch(`/api/tasks/${idea.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete" }) });
                          router.refresh();
                        }}
                        className="rounded-full p-1 text-ink-3 hover:bg-sand hover:text-charcoal"
                        aria-label="Let this idea go"
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
