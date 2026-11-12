"use client";

import { Code2, Eye, History, Loader2, MessageSquare } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { autostartKey } from "@/lib/autostart";
import { readEventStream } from "@/lib/chat-events";
import { cn } from "@/lib/utils";
import { BuilderHeader } from "./builder-header";
import { ChatPanel } from "./chat-panel";
import { HistoryPanel } from "./history-panel";
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
  versionNumber?: number;
  streaming?: boolean;
  thinking?: boolean;
  usage?: { inputTokens: number; outputTokens: number; costUsd?: number };
};

export type ProjectInfo = { id: string; name: string; kit: string };

type Props = {
  project: ProjectInfo;
  userEmail: string;
  initialFiles: Record<string, string>;
  initialMessages: BuilderMessage[];
  initialPreviewToken: string;
  busyOnLoad: boolean;
};

type View = "chat" | "preview" | "code" | "history";

let activityCounter = 0;

export function Builder({ project: initialProject, userEmail, initialFiles, initialMessages, initialPreviewToken, busyOnLoad }: Props) {
  const isMobile = useIsMobile();
  const [project, setProject] = useState(initialProject);
  const [files, setFiles] = useState(initialFiles);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState(initialMessages);
  const [running, setRunning] = useState(false);
  const [desktopTab, setDesktopTab] = useState<View>("preview");
  const [mobileView, setMobileView] = useState<View>("chat");
  const [previewUnseen, setPreviewUnseen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [previewToken, setPreviewToken] = useState(initialPreviewToken);
  const [historyKey, setHistoryKey] = useState(0);
  const [selectedPath, setSelectedPath] = useState<string | null>(
    "index.html" in initialFiles ? "index.html" : (Object.keys(initialFiles)[0] ?? null),
  );
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileViewRef = useRef(mobileView);
  useEffect(() => {
    mobileViewRef.current = mobileView;
  }, [mobileView]);

  const show = useCallback(
    (view: View) => {
      if (isMobile) {
        setMobileView(view);
        if (view === "preview") setPreviewUnseen(false);
      } else if (view !== "chat") {
        setDesktopTab(view);
      }
    },
    [isMobile],
  );

  const refreshFiles = useCallback(async () => {
    const res = await fetch(`/api/projects/${project.id}/files`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { files: { path: string; content: string }[]; previewToken: string };
    setFiles(Object.fromEntries(data.files.map((f) => [f.path, f.content])));
    setPreviewToken(data.previewToken);
  }, [project.id]);

  const bumpPreview = useCallback(() => {
    setPreviewVersion((v) => v + 1);
    if (mobileViewRef.current !== "preview") setPreviewUnseen(true);
  }, []);

  /** Debounced: refresh the file list and reload the preview after the agent writes. */
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(async () => {
      await refreshFiles();
      bumpPreview();
    }, 400);
  }, [refreshFiles, bumpPreview]);

  useEffect(() => () => void (refreshTimer.current && clearTimeout(refreshTimer.current)), []);

  const updateLast = (fn: (m: BuilderMessage) => BuilderMessage) =>
    setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? fn(m) : m)));

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
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
              updateLast((m) => ({ ...m, text: m.text.trim() ? m.text : event.text }));
              break;
            case "error":
              updateLast((m) => ({ ...m, error: event.message }));
              break;
            case "saved":
              updateLast((m) => ({ ...m, id: event.messageId, versionNumber: event.versionNumber }));
              setHistoryKey((k) => k + 1);
              break;
          }
        }
      } catch (err) {
        updateLast((m) => ({ ...m, error: err instanceof Error ? err.message : String(err) }));
      } finally {
        updateLast((m) => ({ ...m, streaming: false, thinking: false }));
        setRunning(false);
        await refreshFiles();
        bumpPreview();
      }
    },
    [project.id, refreshFiles, scheduleRefresh, bumpPreview],
  );

  // A project created from the home page arrives with its first prompt waiting.
  const autostarted = useRef(false);
  useEffect(() => {
    if (autostarted.current) return;
    autostarted.current = true;
    let prompt: string | null = null;
    try {
      prompt = sessionStorage.getItem(autostartKey(project.id));
      sessionStorage.removeItem(autostartKey(project.id));
    } catch {
      /* storage unavailable */
    }
    if (prompt && messages.length === 0) void sendMessage(prompt);
  }, [project.id, messages.length, sendMessage]);

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
    bumpPreview();
    setHistoryKey((k) => k + 1);
    return null;
  }

  async function onRestored(versionNumber: number) {
    setDrafts({});
    await refreshFiles();
    bumpPreview();
    setHistoryKey((k) => k + 1);
    setMessages((prev) => [
      ...prev,
      {
        id: `restore-${Date.now()}`,
        role: "assistant",
        text: `Restored the project files. They are now saved as **v${versionNumber}**.`,
        changedFiles: [],
        activity: [],
      },
    ]);
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
    show("code");
  }

  const hasDrafts = Object.keys(drafts).length > 0;

  const chat = (
    <ChatPanel
      messages={messages}
      running={running}
      busyOnLoad={busyOnLoad}
      onSend={sendMessage}
      onStop={stop}
      onOpenFile={openFile}
      onShowPreview={isMobile ? () => show("preview") : undefined}
    />
  );
  const preview = (
    <PreviewPanel
      project={project}
      previewToken={previewToken}
      files={files}
      version={previewVersion}
      onReload={() => setPreviewVersion((v) => v + 1)}
    />
  );
  const code = (
    <CodePanel
      files={files}
      drafts={drafts}
      selectedPath={selectedPath}
      onSelect={setSelectedPath}
      onChange={setDraft}
      onSave={saveFile}
    />
  );
  const history = (
    <HistoryPanel
      projectId={project.id}
      refreshKey={historyKey}
      running={running}
      hasDrafts={hasDrafts}
      onRestored={onRestored}
    />
  );

  return (
    <div className="flex h-dvh flex-col">
      <BuilderHeader
        projectId={project.id}
        name={project.name}
        kit={project.kit}
        running={running}
        userEmail={userEmail}
        onRenamed={(name) => setProject((p) => ({ ...p, name }))}
      />

      {isMobile ? (
        <>
          {/* All views stay mounted so typing, scroll and the preview survive tab switches. */}
          <div className="relative min-h-0 flex-1">
            {(
              [
                ["chat", chat],
                ["preview", preview],
                ["code", code],
                ["history", history],
              ] as const
            ).map(([view, node]) => (
              <div key={view} className={cn("absolute inset-0", mobileView !== view && "hidden")}>
                {node}
              </div>
            ))}
          </div>
          <MobileNav
            view={mobileView}
            onChange={show}
            running={running}
            previewUnseen={previewUnseen}
            hasDrafts={hasDrafts}
          />
        </>
      ) : (
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel defaultSize="34" minSize="24">
            {chat}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel minSize="30">
            <Tabs value={desktopTab} onValueChange={(v) => setDesktopTab(v as View)} className="flex h-full flex-col gap-0">
              <div className="flex h-10 shrink-0 items-center border-b px-2">
                <TabsList>
                  <TabsTrigger value="preview">
                    <Eye /> Preview
                  </TabsTrigger>
                  <TabsTrigger value="code">
                    <Code2 /> Code
                    {hasDrafts && <span className="size-1.5 rounded-full bg-amber-500" aria-label="Unsaved changes" />}
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    <History /> History
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="preview" className="min-h-0 flex-1">
                {preview}
              </TabsContent>
              <TabsContent value="code" className="min-h-0 flex-1">
                {code}
              </TabsContent>
              <TabsContent value="history" className="min-h-0 flex-1">
                {history}
              </TabsContent>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}

const NAV_ITEMS = [
  { view: "chat", label: "Chat", icon: MessageSquare },
  { view: "preview", label: "Preview", icon: Eye },
  { view: "code", label: "Code", icon: Code2 },
  { view: "history", label: "History", icon: History },
] as const;

function MobileNav({
  view,
  onChange,
  running,
  previewUnseen,
  hasDrafts,
}: {
  view: View;
  onChange: (v: View) => void;
  running: boolean;
  previewUnseen: boolean;
  hasDrafts: boolean;
}) {
  return (
    <nav
      className="grid shrink-0 grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)]"
      aria-label="Builder views"
    >
      {NAV_ITEMS.map((item) => {
        const active = view === item.view;
        const dot =
          (item.view === "preview" && previewUnseen) ||
          (item.view === "code" && hasDrafts) ||
          (item.view === "chat" && running && !active);
        return (
          <button
            key={item.view}
            type="button"
            onClick={() => onChange(item.view)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span className="relative">
              <item.icon className="size-5" />
              {dot && (
                <span
                  className={cn(
                    "absolute -top-0.5 -right-1 size-2 rounded-full",
                    item.view === "code" ? "bg-amber-500" : "bg-primary",
                    item.view === "chat" && "animate-pulse",
                  )}
                />
              )}
            </span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
