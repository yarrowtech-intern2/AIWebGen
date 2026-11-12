"use client";

import { Bot, FilePlus2, History, Loader2, PenLine, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Version = { id: string; number: number; source: string; summary: string; createdAt: string };

const SOURCE = {
  ai: { icon: Bot, label: "Claude" },
  manual: { icon: PenLine, label: "You edited" },
  template: { icon: FilePlus2, label: "Created" },
  restore: { icon: History, label: "Restored" },
} as Record<string, { icon: typeof Bot; label: string }>;

const timeFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

type Props = {
  projectId: string;
  /** Changes whenever a new version may exist; triggers a reload. */
  refreshKey: number;
  running: boolean;
  hasDrafts: boolean;
  onRestored: (versionNumber: number) => void;
};

export function HistoryPanel({ projectId, refreshKey, running, hasDrafts, onRestored }: Props) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/versions`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setVersions(data.versions ?? []);
        setCurrentId(data.currentVersionId ?? null);
      })
      .catch(() => !cancelled && setError("Couldn't load history."));
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  async function restore(v: Version) {
    setBusyId(v.id);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/versions/${v.id}/restore`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    setConfirmId(null);
    if (!res.ok) {
      setError(data.error ?? "Restore failed");
      return;
    }
    onRestored(data.number);
  }

  if (!versions) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading history…
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <p className="mb-3 text-xs text-muted-foreground">
        A version is saved after every change Claude makes and every manual save. Restoring brings back that
        version&apos;s files as a new version, so nothing is lost.
      </p>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      <ol className="flex flex-col gap-1.5">
        {versions.map((v) => {
          const meta = SOURCE[v.source] ?? SOURCE.manual;
          const isCurrent = v.id === currentId;
          return (
            <li
              key={v.id}
              className={cn("flex flex-col gap-2 rounded-lg border p-3 text-sm", isCurrent && "border-primary/50 bg-primary/5")}
            >
              <div className="flex items-start gap-2.5">
                <meta.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium" title={v.summary}>
                    v{v.number} · {v.summary}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {meta.label} · {timeFormat.format(new Date(v.createdAt))}
                  </span>
                </div>
                {isCurrent ? (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Current
                  </span>
                ) : (
                  confirmId !== v.id && (
                    <Button size="xs" variant="outline" disabled={running} onClick={() => setConfirmId(v.id)}>
                      <RotateCcw /> Restore
                    </Button>
                  )
                )}
              </div>
              {confirmId === v.id && (
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-2 text-xs">
                  <span className="flex-1">
                    Replace the current files with v{v.number}?
                    {hasDrafts && " Unsaved editor changes will be discarded."}
                  </span>
                  <Button size="xs" disabled={busyId === v.id} onClick={() => restore(v)}>
                    {busyId === v.id && <Loader2 className="animate-spin" />} Restore v{v.number}
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setConfirmId(null)}>
                    Cancel
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
