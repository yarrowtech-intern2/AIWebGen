"use client";

import {
  ArrowRight,
  ArrowUp,
  Atom,
  ChevronDown,
  Flower2,
  Globe,
  LayoutTemplate,
  Loader2,
  Mic,
  Palette,
  Smartphone,
  UtensilsCrossed,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { autostartKey } from "@/lib/autostart";
import { cn } from "@/lib/utils";

const KITS = [
  { id: "static", label: "Website", icon: Globe, hint: "HTML + Tailwind. Simple, fast, hosts anywhere." },
  { id: "react-vite", label: "React app", icon: Atom, hint: "Components and state. Best for interactive apps." },
] as const;
type KitId = (typeof KITS)[number]["id"];

const IDEAS = [
  { icon: Flower2, label: "Yoga studio site", prompt: "A landing page for my yoga studio in Pune with class timings and pricing" },
  { icon: Palette, label: "Designer portfolio", prompt: "A portfolio for a UI designer with case studies and a contact form" },
  { icon: UtensilsCrossed, label: "Restaurant menu", prompt: "A menu and reservations site for a South Indian restaurant" },
  { icon: Smartphone, label: "App launch page", prompt: "A launch page for a mobile app with features, pricing and FAQ" },
];

export type TemplateOption = { slug: string; name: string; description: string; kits: string[] };

export function PromptBox({ templates = [] }: { templates?: TemplateOption[] }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [kit, setKit] = useState<KitId>("static");
  const [busy, setBusy] = useState<string | null>(null); // "prompt" or a template slug
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dictation = useDictation((text) => setPrompt((p) => (p.trim() ? `${p.trimEnd()} ${text}` : text)));

  async function create(body: Record<string, string>, busyKey: string, firstPrompt?: string) {
    setBusy(busyKey);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the project");
      if (firstPrompt) {
        try {
          sessionStorage.setItem(autostartKey(data.id), firstPrompt);
        } catch {
          /* the user can resend from the builder */
        }
      }
      router.push(`/project/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }

  function submit() {
    const text = prompt.trim();
    if (!text || busy) return;
    dictation.stop();
    void create({ prompt: text, kit }, "prompt", text);
  }

  const current = KITS.find((k) => k.id === kit) ?? KITS[0];
  const visibleTemplates = templates.filter((t) => t.kits.includes(kit));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="composer-shell glass-surface flex flex-col gap-2 rounded-2xl px-3.5 pt-3 pb-2.5 sm:px-4"
        >
          <span className="composer-glow" aria-hidden="true" />
          <label htmlFor="prompt" className="sr-only">
            Describe your website
          </label>
          <textarea
            id="prompt"
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              const touch = window.matchMedia("(pointer: coarse)").matches;
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !touch) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            maxLength={10_000}
            placeholder="Describe the website you want: who it's for, the sections, the look and feel…"
            className="field-sizing-content max-h-48 min-h-13 w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-faint"
          />

          <div className="flex items-center gap-1.5">
            {/* Kit picker: a pill with a native <select> on top (works well on phones). */}
            <div
              className="relative flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-foreground/[0.06] pr-2.5 pl-2.5 text-xs font-semibold hover:bg-foreground/10"
              title={current.hint}
            >
              <current.icon className="size-3.5 text-brand" />
              {current.label}
              <ChevronDown className="size-3 text-faint" />
              <select
                aria-label="What to build"
                value={kit}
                onChange={(e) => setKit(e.target.value as KitId)}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                {KITS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="hidden truncate text-xs text-faint md:inline">{current.hint}</span>

            <span className="flex-1" />

            {dictation.supported && (
              <button
                type="button"
                onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
                aria-label={dictation.listening ? "Stop dictation" : "Dictate your idea"}
                aria-pressed={dictation.listening}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground",
                  dictation.listening &&
                    "animate-[mic-pulse_1.4s_ease-out_infinite] bg-destructive text-white hover:bg-destructive hover:text-white",
                )}
              >
                <Mic className="size-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={!prompt.trim() || !!busy}
              aria-label="Build it"
              className="flex size-9 items-center justify-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-40"
            >
              {busy === "prompt" ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
        </form>

        {(error || dictation.error) && (
          <p role="alert" className="px-1 text-sm text-destructive">
            {error ?? dictation.error}
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          {IDEAS.map(({ icon: Icon, label, prompt: idea }) => (
            <button
              key={label}
              type="button"
              title={idea}
              onClick={() => {
                setPrompt(idea);
                inputRef.current?.focus();
              }}
              className="glass-surface flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {visibleTemplates.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <LayoutTemplate className="size-4 text-brand" />
            Start from a template
          </h2>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {visibleTemplates.map((t) => (
              <button
                key={t.slug}
                type="button"
                disabled={!!busy}
                onClick={() => void create({ name: t.name, kit, template: t.slug }, t.slug)}
                className="glass-surface group flex flex-col gap-1.5 rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  {busy === t.slug && <Loader2 className="size-3.5 animate-spin" />}
                  {t.name}
                  <ArrowRight className="ml-auto size-3.5 text-faint transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{t.description}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------- voice dictation (Web Speech API, where the browser has it) ----------

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

function useDictation(onText: (text: string) => void) {
  const supported = useSyncExternalStore(noopSubscribe, () => !!recognitionCtor(), () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });
  useEffect(() => () => rec.current?.stop(), []);

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    setError(null);
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = false;
    r.continuous = true;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) onTextRef.current(res[0].transcript.trim());
      }
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") setError("Microphone access was blocked.");
      else if (e.error !== "aborted" && e.error !== "no-speech") setError("Dictation stopped unexpectedly.");
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }

  function stop() {
    rec.current?.stop();
    rec.current = null;
    setListening(false);
  }

  return { supported, listening, error, start, stop };
}
