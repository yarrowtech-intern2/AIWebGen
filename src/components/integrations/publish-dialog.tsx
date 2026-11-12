"use client";

import { CheckCircle2, ExternalLink, Loader2, Rocket, Triangle } from "lucide-react";
import { GithubIcon } from "@/components/icons/github";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ConnectForm, disconnect, type IntegrationStatus, type Provider } from "./connect-form";

type Target = "github-pages" | "vercel";
export type PublishInfo = { target: Target | null; githubRepo: string | null; url: string | null };

const TARGETS: { id: Target; provider: Provider; label: string; hint: string; icon: typeof Triangle | typeof GithubIcon }[] = [
  { id: "github-pages", provider: "github", label: "GitHub Pages", hint: "Free. Code and site live in your GitHub.", icon: GithubIcon },
  { id: "vercel", provider: "vercel", label: "Vercel", hint: "Fast global hosting, deploys in seconds.", icon: Triangle },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "my-site";

type Props = {
  projectId: string;
  projectName: string;
  integrations: Record<Provider, IntegrationStatus>;
  onIntegrationsChange: (next: Record<Provider, IntegrationStatus>) => void;
  published: PublishInfo;
  onPublished: (info: PublishInfo) => void;
  disabled?: boolean;
};

export function PublishDialog({ projectId, projectName, integrations, onIntegrationsChange, published, onPublished, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Target>(published.target ?? "github-pages");
  const [repoName, setRepoName] = useState(published.githubRepo?.split("/")[1] ?? slug(projectName));
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ siteUrl: string; repoUrl?: string; note: string } | null>(null);

  const current = TARGETS.find((t) => t.id === target)!;
  const status = integrations[current.provider];

  async function publish() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch(`/api/projects/${projectId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, repoName, isPrivate }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Publishing failed");
      if (data.needsConnection) onIntegrationsChange({ ...integrations, [data.needsConnection]: { connected: false } });
      return;
    }
    setResult(data);
    onPublished({ target, githubRepo: data.repoUrl ? new URL(data.repoUrl).pathname.slice(1) : published.githubRepo, url: data.siteUrl });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setResult(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Rocket /> <span className="hidden sm:inline">Publish</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish your site</DialogTitle>
          <DialogDescription>
            {published.url ? (
              <>
                Live at{" "}
                <a href={published.url} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2">
                  {published.url.replace(/^https:\/\//, "")}
                </a>
                . Publishing again updates it.
              </>
            ) : (
              "Put your site on the internet with a shareable link."
            )}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-10 text-green-600" />
            <p className="font-medium">Published!</p>
            <p className="text-sm text-muted-foreground">{result.note}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <a href={result.siteUrl} target="_blank" rel="noopener noreferrer">
                  Open site <ExternalLink />
                </a>
              </Button>
              {result.repoUrl && (
                <Button variant="outline" asChild>
                  <a href={result.repoUrl} target="_blank" rel="noopener noreferrer">
                    <GithubIcon /> View code
                  </a>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div role="radiogroup" aria-label="Where to publish" className="grid grid-cols-2 gap-2">
              {TARGETS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={target === t.id}
                  onClick={() => setTarget(t.id)}
                  className={cn(
                    "flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
                    target === t.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <t.icon className="size-4" /> {t.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{t.hint}</span>
                </button>
              ))}
            </div>

            {status.connected ? (
              <p className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  Connected as <span className="font-medium text-foreground">{status.accountName}</span>
                </span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-muted-foreground"
                  onClick={async () => {
                    await disconnect(current.provider);
                    onIntegrationsChange({ ...integrations, [current.provider]: { connected: false } });
                  }}
                >
                  Disconnect
                </Button>
              </p>
            ) : (
              <ConnectForm
                provider={current.provider}
                onConnected={(s) => onIntegrationsChange({ ...integrations, [current.provider]: s })}
              />
            )}

            {target === "github-pages" && status.connected && (
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex flex-col gap-1.5">
                  Repository name
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">{status.accountName}/</span>
                    <Input value={repoName} onChange={(e) => setRepoName(slug(e.target.value))} maxLength={50} className="flex-1" />
                  </div>
                </label>
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="mt-0.5" />
                  <span>
                    Private repository
                    <span className="block text-xs text-muted-foreground">GitHub Pages on private repos needs a paid GitHub plan.</span>
                  </span>
                </label>
              </div>
            )}

            {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}

            <Button size="lg" disabled={!status.connected || busy || (target === "github-pages" && !repoName)} onClick={publish}>
              {busy ? <Loader2 className="animate-spin" /> : <Rocket />}
              {busy ? "Publishing…" : `Publish to ${current.label}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
