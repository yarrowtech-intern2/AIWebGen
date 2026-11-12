"use client";

import { AlertCircle, ArrowUp, FilePen, FileX, Loader2, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Activity, BuilderMessage } from "./builder";
import { Markdown } from "./markdown";

const SUGGESTIONS = [
  "A landing page for a specialty coffee roastery in Bengaluru, with menu, story and visit-us sections",
  "A portfolio for a wedding photographer: hero gallery, packages with prices, testimonials, contact form",
  "A SaaS landing page for an invoicing app for freelancers: features, pricing tiers, FAQ",
];

type Props = {
  messages: BuilderMessage[];
  running: boolean;
  busyOnLoad: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onOpenFile: (path: string) => void;
};

export function ChatPanel({ messages, running, busyOnLoad, onSend, onStop, onOpenFile }: Props) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view while streaming.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function submit(text = input) {
    if (!text.trim() || running) return;
    onSend(text.trim());
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {busyOnLoad && !running && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
            A previous request may still be running. Reload in a moment, or stop it.
            <Button size="xs" variant="outline" onClick={onStop}>
              Stop
            </Button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-col gap-3 pt-6">
            <p className="text-sm font-medium">What should we build?</p>
            <p className="text-sm text-muted-foreground">
              Describe the site: who it&apos;s for, the sections you want, and the look and feel. Then refine it by
              chatting.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {messages.map((m) => (
              <li key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
                    {m.text}
                  </div>
                ) : (
                  <AssistantMessage message={m} onOpenFile={onOpenFile} />
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <form
        className="shrink-0 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={messages.length ? "Ask for a change…" : "Describe your website…"}
            aria-label="Message"
            rows={3}
            className="max-h-48 resize-none pr-12"
          />
          {running ? (
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              onClick={onStop}
              aria-label="Stop"
              className="absolute right-2 bottom-2"
            >
              <Square className="fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon-sm" disabled={!input.trim()} aria-label="Send" className="absolute right-2 bottom-2">
              <ArrowUp />
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">Enter to send · Shift+Enter for a new line</p>
      </form>
    </div>
  );
}

function AssistantMessage({ message: m, onOpenFile }: { message: BuilderMessage; onOpenFile: (p: string) => void }) {
  return (
    <div className="flex w-full max-w-[95%] flex-col gap-2 text-sm">
      {m.activity.length > 0 && <ActivityList items={m.activity} />}

      {m.text && (
        <div className="leading-relaxed">
          <Markdown text={m.text} />
        </div>
      )}

      {m.streaming && m.thinking && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> {m.activity.length ? "Working…" : "Thinking…"}
        </span>
      )}

      {m.error && (
        <p className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="mt-px size-3.5 shrink-0" /> {m.error}
        </p>
      )}

      {!m.streaming && m.changedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {m.changedFiles.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onOpenFile(f)}
              className="flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-[11px] hover:bg-muted"
              title="Open in code view"
            >
              <FilePen className="size-3" /> {f}
            </button>
          ))}
        </div>
      )}

      {!m.streaming && (m.usage || m.versionNumber) && (
        <span className="text-[11px] text-muted-foreground">
          {m.versionNumber && <>Saved as v{m.versionNumber}{m.usage && " · "}</>}
          {m.usage && (
            <>
              {m.usage.inputTokens.toLocaleString()} in · {m.usage.outputTokens.toLocaleString()} out
              {m.usage.costUsd !== undefined && ` · ~${m.usage.costUsd.toFixed(3)}`}
            </>
          )}
        </span>
      )}
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  list_files: "Listed files",
  read_file: "Read",
  write_file: "Wrote",
  edit_file: "Edited",
  delete_file: "Deleted",
};

function ActivityList({ items }: { items: Activity[] }) {
  return (
    <ul className="flex flex-col gap-0.5 border-l-2 pl-2.5 text-xs text-muted-foreground">
      {items.map((a) => (
        <li key={a.id} className={cn("flex items-center gap-1.5", a.error && "text-destructive")}>
          {a.error ? <FileX className="size-3 shrink-0" /> : <FilePen className="size-3 shrink-0" />}
          <span className="truncate">
            {a.error ? `${a.tool}: ${a.error}` : `${TOOL_LABELS[a.tool] ?? a.tool}${a.path ? ` ${a.path}` : ""}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
