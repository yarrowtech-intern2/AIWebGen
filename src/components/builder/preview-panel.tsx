"use client";

import { AlertTriangle, ExternalLink, Monitor, RotateCw, Smartphone, Sparkles, Tablet } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ProjectInfo } from "./builder";

const DEVICES = [
  { id: "desktop", label: "Desktop", icon: Monitor, width: "100%" },
  { id: "tablet", label: "Tablet (768px)", icon: Tablet, width: "768px" },
  { id: "mobile", label: "Mobile (390px)", icon: Smartphone, width: "390px" },
] as const;

type Props = {
  project: ProjectInfo;
  previewToken: string;
  files: Record<string, string>;
  version: number;
  onReload: () => void;
  /** React kit: errors from the last preview build. */
  buildErrors?: string[];
  onAskFix?: () => void;
  fixDisabled?: boolean;
};

export function PreviewPanel({ project, previewToken, files, version, onReload, buildErrors, onAskFix, fixDisabled }: Props) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const [page, setPage] = useState("index.html");

  // React apps have a single entry page; static sites can have many.
  const pages = Object.keys(files)
    .filter((p) => p.endsWith(".html") && (project.kit === "static" || p === "index.html"))
    .sort((a, b) => (a === "index.html" ? -1 : b === "index.html" ? 1 : a.localeCompare(b)));
  const currentPage = pages.includes(page) ? page : (pages[0] ?? "index.html");
  const src = `/preview/${previewToken}/${currentPage}?v=${version}`;
  const width = DEVICES.find((d) => d.id === device)!.width;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
        <select
          hidden={pages.length < 2}
          value={currentPage}
          onChange={(e) => setPage(e.target.value)}
          aria-label="Page"
          className="mr-auto h-8 max-w-48 rounded-md border bg-background px-2 font-mono text-xs md:mr-0 md:h-7"
        >
          {pages.length === 0 && <option value="index.html">index.html</option>}
          {pages.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <div className="mx-auto hidden items-center gap-0.5 md:flex">
          {DEVICES.map((d) => (
            <Tooltip key={d.id}>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant={device === d.id ? "secondary" : "ghost"}
                  aria-label={d.label}
                  aria-pressed={device === d.id}
                  onClick={() => setDevice(d.id)}
                >
                  <d.icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{d.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Reload preview" onClick={onReload}>
              <RotateCw />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reload</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-sm" variant="ghost" asChild>
              <a href={`/preview/${previewToken}/${currentPage}`} target="_blank" rel="noopener noreferrer" aria-label="Open in new tab">
                <ExternalLink />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open in new tab</TooltipContent>
        </Tooltip>
      </div>

      {buildErrors && buildErrors.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate" title={buildErrors.join("\n")}>
            The preview has a build error: {buildErrors[0].split("\n")[0]}
          </span>
          {onAskFix && (
            <Button size="sm" onClick={onAskFix} disabled={fixDisabled}>
              <Sparkles /> Ask Claude to fix
            </Button>
          )}
        </div>
      )}

      <div className={cn("flex min-h-0 flex-1 justify-center overflow-auto", device !== "desktop" && "bg-muted/60 p-4")}>
        <iframe
          key={currentPage}
          src={src}
          title="Site preview"
          // No allow-same-origin: generated code can't touch the builder's cookies or API.
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
          className={cn("h-full border-0 bg-white", device !== "desktop" && "rounded-lg shadow-lg ring-1 ring-border")}
          style={{ width, maxWidth: "100%" }}
        />
      </div>
    </div>
  );
}
