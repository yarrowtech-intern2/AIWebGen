"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const KIT_OPTIONS = [
  { id: "static", label: "Static", hint: "HTML + Tailwind", available: true },
  { id: "react-vite", label: "React", hint: "Preview coming in M4", available: false },
] as const;

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kit, setKit] = useState<string>("static");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Untitled site", kit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create project");
      router.push(`/project/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name, e.g. Mishti Corner"
          maxLength={80}
          aria-label="Project name"
          className="flex-1"
        />
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Plus />}
          New project
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm" role="radiogroup" aria-label="Site kit">
        <span className="text-muted-foreground">Kit:</span>
        {KIT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={kit === option.id}
            disabled={!option.available}
            onClick={() => setKit(option.id)}
            className={cn(
              "rounded-full border px-3 py-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              kit === option.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              !option.available && "cursor-not-allowed opacity-50 hover:bg-transparent",
            )}
          >
            {option.label} <span className="opacity-70">· {option.hint}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
