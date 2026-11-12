"use client";

import { ArrowLeft, Check, Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserMenu } from "@/components/user-menu";

type Props = {
  projectId: string;
  name: string;
  kit: string;
  running: boolean;
  userEmail: string;
  onRenamed: (name: string) => void;
  /** Primary action slot (e.g. Publish). */
  actions?: ReactNode;
};

export function BuilderHeader({ projectId, name, kit, running, userEmail, onRenamed, actions }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);

  async function save() {
    const next = draft.trim();
    if (!next || next === name) return setEditing(false);
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    });
    setSaving(false);
    if (res.ok) onRenamed(next);
    setEditing(false);
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2 sm:px-3">
      <Link
        href="/"
        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="All projects"
      >
        <ArrowLeft className="size-4" />
      </Link>

      {editing ? (
        <form
          className="flex min-w-0 items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            maxLength={80}
            autoFocus
            aria-label="Project name"
            className="h-8 w-40 sm:w-64"
          />
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4 text-muted-foreground" />}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          className="group flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-muted"
          title="Rename project"
        >
          <h1 className="truncate font-medium">{name}</h1>
          <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
        </button>
      )}

      <Badge variant="secondary" className="hidden sm:inline-flex">
        {kit === "react-vite" ? "React" : "Static"}
      </Badge>
      {running && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          <Loader2 className="size-3.5 animate-spin" />
          <span className="hidden sm:inline">Claude is working…</span>
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        {actions}
        <UserMenu email={userEmail} />
        <ThemeToggle />
      </div>
    </header>
  );
}
