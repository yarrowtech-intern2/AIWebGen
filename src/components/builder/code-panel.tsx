"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { ChevronDown, ChevronRight, FileCode2, Folder, Loader2, Save } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LANGUAGES: Record<string, string> = {
  html: "html",
  css: "css",
  js: "javascript",
  mjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  md: "markdown",
  svg: "xml",
  xml: "xml",
};

type Props = {
  files: Record<string, string>;
  drafts: Record<string, string>;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onChange: (path: string, value: string) => void;
  /** Resolves to an error message, or null on success. */
  onSave: (path: string) => Promise<string | null>;
};

export function CodePanel({ files, drafts, selectedPath, onSelect, onChange, onSave }: Props) {
  const { resolvedTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const tree = useMemo(() => buildTree(Object.keys(files)), [files]);

  const path = selectedPath && selectedPath in files ? selectedPath : null;
  const value = path ? (drafts[path] ?? files[path]) : "";
  const dirty = path ? path in drafts : false;

  async function save() {
    if (!path || !(path in drafts)) return;
    setSaving(true);
    setSaveError(await onSave(path));
    setSaving(false);
  }

  // Monaco keeps the first closure it gets for commands; route through a ref.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  const handleMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void saveRef.current());
  };

  return (
    <div className="flex h-full">
      <nav className="w-56 shrink-0 overflow-y-auto border-r py-2 text-sm" aria-label="Project files">
        <TreeLevel nodes={tree} depth={0} selected={path} drafts={drafts} onSelect={onSelect} />
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3 text-xs">
          <span className="truncate font-mono">{path ?? "No file selected"}</span>
          {dirty && <span className="text-amber-600 dark:text-amber-400">● unsaved</span>}
          {saveError && <span className="truncate text-destructive">{saveError}</span>}
          <Button size="xs" variant="outline" className="ml-auto" disabled={!dirty || saving} onClick={save}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
            <kbd className="ml-1 hidden text-[10px] opacity-60 sm:inline">Ctrl+S</kbd>
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          {path ? (
            <Editor
              path={path}
              value={value}
              language={LANGUAGES[path.split(".").pop() ?? ""] ?? "plaintext"}
              theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
              onChange={(v) => onChange(path, v ?? "")}
              onMount={handleMount}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: "on",
                scrollBeyondLastLine: false,
                tabSize: 2,
                automaticLayout: true,
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a file to view its code.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- File tree -----------------------------------------------------------------

type TreeNode = { name: string; path: string; children?: TreeNode[] };

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", children: [] };
  for (const p of paths) {
    const parts = p.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      const nodePath = parts.slice(0, i + 1).join("/");
      let child = node.children!.find((c) => c.name === part && !!c.children === !isFile);
      if (!child) {
        child = isFile ? { name: part, path: nodePath } : { name: part, path: nodePath, children: [] };
        node.children!.push(child);
      }
      node = child;
    });
  }
  const sort = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .sort((a, b) => (!!b.children === !!a.children ? a.name.localeCompare(b.name) : b.children ? 1 : -1))
      .map((n) => (n.children ? { ...n, children: sort(n.children) } : n));
  return sort(root.children!);
}

function TreeLevel({
  nodes,
  depth,
  selected,
  drafts,
  onSelect,
}: {
  nodes: TreeNode[];
  depth: number;
  selected: string | null;
  drafts: Record<string, string>;
  onSelect: (path: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const indent = { paddingLeft: `${0.5 + depth * 0.75}rem` };

  return (
    <ul>
      {nodes.map((node) =>
        node.children ? (
          <li key={node.path}>
            <button
              type="button"
              style={indent}
              className="flex w-full items-center gap-1 py-1 pr-2 text-left text-muted-foreground hover:bg-muted"
              aria-expanded={!collapsed.has(node.path)}
              onClick={() =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(node.path)) next.delete(node.path);
                  else next.add(node.path);
                  return next;
                })
              }
            >
              {collapsed.has(node.path) ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              <Folder className="size-3.5" /> {node.name}
            </button>
            {!collapsed.has(node.path) && (
              <TreeLevel nodes={node.children} depth={depth + 1} selected={selected} drafts={drafts} onSelect={onSelect} />
            )}
          </li>
        ) : (
          <li key={node.path}>
            <button
              type="button"
              style={indent}
              onClick={() => onSelect(node.path)}
              aria-current={selected === node.path ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-1.5 py-1 pr-2 pl-5 text-left hover:bg-muted",
                selected === node.path && "bg-muted font-medium",
              )}
            >
              <FileCode2 className="ml-3.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{node.name}</span>
              {node.path in drafts && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-amber-500" />}
            </button>
          </li>
        ),
      )}
    </ul>
  );
}
