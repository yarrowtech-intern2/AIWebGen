"use client";

import { ArrowLeft, Code2, Eye, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readEventStream } from "@/lib/chat-events";
import { ChatPanel } from "./chat-panel";
import { PreviewPanel } from "./preview-panel";

// Monaco is browser-only.
const CodePanel = dynamic(() => import("./code-panel").then((m) => m.CodePanel), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Loading editor…
    </div>
  ),
});

export type Activity = { id: number; tool: string; path?: string; error?: string };

export type BuilderMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  changedFiles: string[];
  activity: Activity[];
  error?: string;
  streaming?: boolean;
  thinking?: boolean;
  usage?: { inputTokens: number; outputTokens: number; costUsd?: number };
};

export type ProjectInfo = { id: string; name: string; kit: string };

type Props = {
  project: ProjectInfo;
  initialFiles: Record<string, string>;
  initialMessages: BuilderMessage[];
  busyOnLoad: boolean;
};

let activityCounter = 0;

export function Builder({ project, initialFiles, initialMessages, busyOnLoad }: Props) {
  const [files, setFiles] = useState(initialFiles);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState(initialMessages);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState("preview");
  const [previewVersion, setPreviewVersion] = useState(0);
  const [selectedPath, setSelectedPath] = useState<string | null>(
    "index.html" in initialFiles ? "index.html" : (Object.keys(initialFiles)[0] ?? null),
  );
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshFiles = useCallback(async () => {
    const res = await fetch(`/api/projects/${project.id}/files`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { files: { path: string; content: string }[] };
    setFiles(Object.fromEntries(data.files.map((f) => [f.path, f.content])));
  }, [project.id]);

  /** Debounced: refresh the file list and reload the preview after the agent writes. */
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(async () => {
      await refreshFiles();
      setPreviewVersion((v) => v + 1);
    }, 400);
  }, [refreshFiles]);

  useEffect(() => () => void (refreshTimer.current && clearTimeout(refreshTimer.current)), []);

  const updateLast = (fn: (m: BuilderMessage) => BuilderMessage) =>
    setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? fn(m) : m)));

  async function sendMessage(text: string) {
    if (running || !text.trim()) return;
    setRunning(true);
    const now = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: `u-${now}`, role: "user", text, changedFiles: [], activity: [] },
      { id: `a-${now}`, role: "assistant", text: "", changedFiles: [], activity: [], streaming: true, thinking: true },
    ]);

    try {
      const res = await fetch(`/api/projects/${project.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      for await (const event of readEventStream(res.body)) {
        switch (event.type) {
          case "text_delta":
            updateLast((m) => ({ ...m, text: m.text + event.text, thinking: false }));
            break;
          case "thinking_delta":
            updateLast((m) => ({ ...m, thinking: true }));
            break;
          case "tool_start": {
            const path = typeof event.input.path === "string" ? event.input.path : undefined;
            updateLast((m) => ({
              ...m,
              thinking: true,
              activity: [...m.activity, { id: ++activityCounter, tool: event.tool, path }],
            }));
            break;
          }
          case "tool_error":
            updateLast((m) => ({
              ...m,
              activity: [...m.activity, { id: ++activityCounter, tool: event.tool, error: event.message }],
            }));
            break;
          case "file_changed":
            updateLast((m) =>
              m.changedFiles.includes(event.path) ? m : { ...m, changedFiles: [...m.changedFiles, event.path] },
            );
            scheduleRefresh();
            break;
          case "usage":
            updateLast((m) => ({
              ...m,
              usage: { inputTokens: event.inputTokens, outputTokens: event.outputTokens, costUsd: event.costUsd },
            }));
            break;
          case "done":
            // Keep the streamed text; fall back to the final text if nothing streamed.
            updateLast((m) => ({ ...m, text: m.text.trim() ? m.text : event.text }));
            break;
          case "error":
            updateLast((m) => ({ ...m, error: event.message }));
            break;
          case "saved":
            updateLast((m) => ({ ...m, id: event.messageId }));
            break;
        }
      }
    } catch (err) {
      updateLast((m) => ({ ...m, error: err instanceof Error ? err.message : String(err) }));
    } finally {
      updateLast((m) => ({ ...m, streaming: false, thinking: false }));
      setRunning(false);
      await refreshFiles();
      setPreviewVersion((v) => v + 1);
    }
  }

  async function stop() {
    await fetch(`/api/projects/${project.id}/chat/stop`, { method: "POST" });
  }

  async function saveFile(path: string): Promise<string | null> {
    const content = drafts[path];
    if (content === undefined) return null;
    const res = await fetch(`/api/projects/${project.id}/files`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? "Save failed";
    setFiles((prev) => ({ ...prev, [path]: content }));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    setPreviewVersion((v) => v + 1);
    return null;
  }

  function setDraft(path: string, value: string) {
    setDrafts((prev) => {
      const next = { ...prev };
      if (value === files[path]) delete next[path];
      else next[path] = value;
      return next;
    });
  }

  function openFile(path: string) {
    setSelectedPath(path);
    setTab("code");
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <Link
          href="/"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="All projects"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="truncate font-medium">{project.name}</h1>
        <Badge variant="secondary">{project.kit}</Badge>
        {running && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Claude is working…
          </span>
        )}
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="34" minSize="24">
          <ChatPanel
            messages={messages}
            running={running}
            busyOnLoad={busyOnLoad}
            onSend={sendMessage}
            onStop={stop}
            onOpenFile={openFile}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize="30">
          <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col gap-0">
            <div className="flex h-10 shrink-0 items-center border-b px-2">
              <TabsList>
                <TabsTrigger value="preview">
                  <Eye /> Preview
                </TabsTrigger>
                <TabsTrigger value="code">
                  <Code2 /> Code
                  {Object.keys(drafts).length > 0 && (
                    <span className="size-1.5 rounded-full bg-amber-500" aria-label="Unsaved changes" />
                  )}
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="preview" className="min-h-0 flex-1">
              <PreviewPanel project={project} files={files} version={previewVersion} onReload={() => setPreviewVersion((v) => v + 1)} />
            </TabsContent>
            <TabsContent value="code" className="min-h-0 flex-1">
              <CodePanel
                files={files}
                drafts={drafts}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
                onChange={setDraft}
                onSave={saveFile}
              />
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
