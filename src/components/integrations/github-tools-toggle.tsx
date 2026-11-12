"use client";

import { GithubIcon } from "@/components/icons/github";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ConnectForm, type IntegrationStatus } from "./connect-form";

type Props = {
  projectId: string;
  github: IntegrationStatus;
  onGithubChange: (s: IntegrationStatus) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
};

/**
 * Chip next to the chat box: lets Claude use the user's GitHub (via the GitHub
 * MCP server) in this project. Connecting GitHub switches it on.
 */
export function GitHubToolsToggle({ projectId, github, onGithubChange, enabled, onEnabledChange }: Props) {
  const [connectOpen, setConnectOpen] = useState(false);

  async function setEnabled(next: boolean) {
    onEnabledChange(next);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ githubToolsEnabled: next }),
    });
    if (!res.ok) onEnabledChange(!next);
  }

  return (
    <>
      <button
        type="button"
        role={github.connected ? "switch" : undefined}
        aria-checked={github.connected ? enabled : undefined}
        onClick={() => (github.connected ? void setEnabled(!enabled) : setConnectOpen(true))}
        title={
          github.connected
            ? enabled
              ? "Claude can use your GitHub in this project. Click to turn off."
              : "Let Claude read your repos, push branches and open pull requests"
            : "Connect GitHub so Claude can import repos and open pull requests"
        }
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
          github.connected && enabled
            ? "border-primary/40 bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <GithubIcon className="size-3.5" />
        {github.connected ? `GitHub ${enabled ? "on" : "off"}` : "Connect GitHub"}
      </button>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Use GitHub in chat</DialogTitle>
            <DialogDescription>
              Ask Claude things like “import the code from my repo portfolio-v1” or “push this to a new branch and open a pull
              request”. Claude never deletes or merges anything.
            </DialogDescription>
          </DialogHeader>
          <ConnectForm
            provider="github"
            onConnected={(s) => {
              onGithubChange(s);
              setConnectOpen(false);
              void setEnabled(true);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
