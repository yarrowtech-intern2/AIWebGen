"use client";

import { Check, FileCode2, Loader2, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  id: string;
  name: string;
  kitLabel: string;
  fileCount: number;
  updatedLabel: string;
};

export function ProjectCard({ id, name, kitLabel, fileCount, updatedLabel }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "rename" | "confirm-delete">("view");
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(method: "PATCH" | "DELETE", body?: object) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${id}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return false;
    }
    router.refresh();
    return true;
  }

  if (mode === "rename") {
    return (
      <form
        className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await call("PATCH", { name: draft })) setMode("view");
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} autoFocus aria-label="Project name" />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />} Save
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setMode("view")}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="group relative flex h-full flex-col rounded-xl border bg-card transition-colors hover:border-primary/50 hover:bg-muted/40">
      <Link
        href={`/project/${id}`}
        className="flex flex-1 flex-col gap-1 rounded-xl p-4 pr-20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="font-medium">{name}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileCode2 className="size-3.5" />
          {kitLabel} · {fileCount} files
        </span>
        <span className="text-xs text-muted-foreground">Updated {updatedLabel}</span>
      </Link>

      {mode === "confirm-delete" ? (
        <div className="flex items-center gap-2 border-t px-4 py-2 text-xs">
          <span className="text-destructive">Delete this project and its history?</span>
          <Button size="xs" variant="destructive" disabled={busy} onClick={() => call("DELETE")}>
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
          </Button>
          <Button size="icon-xs" variant="ghost" aria-label="Cancel" onClick={() => setMode("view")}>
            <X />
          </Button>
        </div>
      ) : (
        <div className="absolute top-3 right-3 flex gap-0.5 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <Button size="icon-sm" variant="ghost" aria-label={`Rename ${name}`} onClick={() => setMode("rename")}>
            <Pencil />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Delete ${name}`} onClick={() => setMode("confirm-delete")}>
            <Trash2 />
          </Button>
        </div>
      )}
      {error && mode !== "confirm-delete" && <p className="px-4 pb-3 text-xs text-destructive">{error}</p>}
    </div>
  );
}
