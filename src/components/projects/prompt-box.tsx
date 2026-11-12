"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { autostartKey } from "@/lib/autostart";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KITS = [
  { id: "static", label: "Website", hint: "HTML + Tailwind. Simple, fast, hosts anywhere." },
  { id: "react-vite", label: "React app", hint: "Components and state. Best for interactive apps." },
] as const;

const IDEAS = [
  "A landing page for my yoga studio in Pune with class timings and pricing",
  "A portfolio for a UI designer with case studies and a contact form",
  "A menu and reservations site for a South Indian restaurant",
  "A launch page for a mobile app with features, pricing and FAQ",
];

export type TemplateOption = { slug: string; name: string; description: string; kits: string[] };

export function PromptBox({ templates = [] }: { templates?: TemplateOption[] }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [kit, setKit] = useState<(typeof KITS)[number]["id"]>("static");
  const [busy, setBusy] = useState<string | null>(null); // "prompt" or a template slug
  const [error, setError] = useState<string | null>(null);

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
    void create({ prompt: text, kit }, "prompt", text);
  }

  const visibleTemplates = templates.filter((t) => t.kits.includes(kit));

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40"
      >
        <label htmlFor="prompt" className="sr-only">
          Describe your website
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            const touch = window.matchMedia("(pointer: coarse)").matches;
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !touch) {
              e.preventDefault();
              submit();
            }
          }}
          rows={4}
          maxLength={10_000}
          placeholder="Describe your website: who it's for, the sections you want, the look and feel…"
          className="w-full resize-none bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground"
        />
        <div className="flex flex-wrap items-center gap-2 px-1 pb-1">
          <div role="radiogroup" aria-label="What to build" className="flex rounded-lg bg-muted p-0.5 text-sm">
            {KITS.map((k) => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={kit === k.id}
                title={k.hint}
                onClick={() => setKit(k.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium transition-colors",
                  kit === k.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
          <Button type="submit" size="lg" className="ml-auto" disabled={!prompt.trim() || !!busy}>
            {busy === "prompt" ? <Loader2 className="animate-spin" /> : null}
            Build it
            {busy !== "prompt" && <ArrowRight />}
          </Button>
        </div>
      </form>
      <p className="-mt-4 px-1 text-xs text-muted-foreground">{KITS.find((k) => k.id === kit)?.hint}</p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!prompt && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">Need an idea?</p>
          <div className="flex flex-wrap gap-2">
            {IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setPrompt(idea)}
                className="rounded-full border px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted"
              >
                {idea}
              </button>
            ))}
          </div>
        </div>
      )}

      {visibleTemplates.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">Or start from a ready-made template</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {visibleTemplates.map((t) => (
              <button
                key={t.slug}
                type="button"
                disabled={!!busy}
                onClick={() => void create({ name: t.name, kit, template: t.slug }, t.slug)}
                className="flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:opacity-60"
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {busy === t.slug && <Loader2 className="size-3.5 animate-spin" />}
                  {t.name}
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{t.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
