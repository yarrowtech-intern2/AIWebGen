"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Provider = "github" | "vercel";
export type IntegrationStatus = { connected: boolean; accountName?: string };

const GUIDES: Record<Provider, { title: string; link: string; linkLabel: string; steps: string[]; placeholder: string }> = {
  github: {
    title: "Connect GitHub",
    link: "https://github.com/settings/personal-access-tokens/new",
    linkLabel: "Create a GitHub token",
    steps: [
      "Give it a name and expiry.",
      'Repository access: "All repositories".',
      'Permissions → set Administration, Contents, Pages, Workflows and Pull requests to "Read and write".',
      "Generate the token and paste it below.",
    ],
    placeholder: "github_pat_…",
  },
  vercel: {
    title: "Connect Vercel",
    link: "https://vercel.com/account/settings/tokens",
    linkLabel: "Create a Vercel token",
    steps: ["Create a token with Full Account scope.", "Paste it below."],
    placeholder: "Vercel token",
  },
};

/** Token-paste connection flow with step-by-step instructions. */
export function ConnectForm({ provider, onConnected }: { provider: Provider; onConnected: (s: IntegrationStatus) => void }) {
  const guide = GUIDES[provider];
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/integrations/${provider}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Couldn't connect");
    setToken("");
    onConnected(data);
  }

  return (
    <form onSubmit={connect} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
      <p className="font-medium">{guide.title}</p>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
        <li>
          <a href={guide.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2">
            {guide.linkLabel} <ExternalLink className="size-3" />
          </a>
        </li>
        {guide.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <div className="flex gap-2">
        <Input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={guide.placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-label={`${provider} token`}
          className="flex-1"
        />
        <Button type="submit" disabled={busy || token.trim().length < 20}>
          {busy && <Loader2 className="animate-spin" />} Connect
        </Button>
      </div>
      {error && <p className="text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">The token is encrypted and only used for your projects. You can disconnect at any time.</p>
    </form>
  );
}

export async function disconnect(provider: Provider) {
  await fetch(`/api/integrations/${provider}`, { method: "DELETE" });
}
