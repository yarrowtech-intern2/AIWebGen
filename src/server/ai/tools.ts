import path from "node:path";
import { z } from "zod";
import type { SiteKit } from "@/kits/types";
import type { ProjectFileStore } from "@/server/projects/file-store";
import type { AgentEvent } from "./types";

export const LIMITS = {
  maxFileBytes: 200_000,
  maxProjectBytes: 2_000_000,
  maxFiles: 200,
  maxReadChars: 100_000,
  maxToolCallsPerTurn: 80,
  maxPathLength: 200,
} as const;

export class ToolInputError extends Error {}

/** Normalises a model-supplied path and confines it to the project. Throws ToolInputError. */
export function normalizeProjectPath(raw: string, allowedExtensions: string[]): string {
  let p = raw.trim().replace(/\\/g, "/");
  if (/^[a-zA-Z]:/.test(p)) throw new ToolInputError(`Absolute paths are not allowed: "${raw}"`);
  p = p.replace(/^\/+/, "").replace(/^(\.\/)+/, "");
  if (!p) throw new ToolInputError("Path is empty");
  if (p.length > LIMITS.maxPathLength) throw new ToolInputError("Path is too long");
  if (/[\x00-\x1f<>:"|?*]/.test(p)) throw new ToolInputError(`Path contains invalid characters: "${raw}"`);
  const segments = p.split("/").filter((s) => s !== "");
  if (segments.some((s) => s === "." || s === "..")) {
    throw new ToolInputError(`Path must stay inside the project: "${raw}"`);
  }
  const normalized = segments.join("/");
  const ext = path.posix.extname(normalized).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw new ToolInputError(
      `File type "${ext || "(none)"}" is not allowed for this kit. Allowed: ${allowedExtensions.join(", ")}`,
    );
  }
  return normalized;
}

// ---- Tool schemas (shared by both providers) --------------------------------

const shapes = {
  list_files: {},
  read_file: {
    path: z.string().describe("Project-relative file path, e.g. index.html or src/App.tsx"),
  },
  write_file: {
    path: z.string().describe("Project-relative file path"),
    content: z.string().describe("The complete new file contents"),
  },
  edit_file: {
    path: z.string().describe("Project-relative file path"),
    old_string: z.string().describe("Exact text to replace; must match the file exactly, including whitespace"),
    new_string: z.string().describe("Replacement text"),
    replace_all: z.boolean().optional().describe("Replace every occurrence instead of requiring a unique match"),
  },
  delete_file: {
    path: z.string().describe("Project-relative file path"),
  },
} satisfies Record<string, z.ZodRawShape>;

export type ToolName = keyof typeof shapes;

const descriptions: Record<ToolName, string> = {
  list_files: "List every file in the project with its size in bytes.",
  read_file: "Read the full contents of one project file. Read a file before editing it unless you just wrote it.",
  write_file:
    "Create a file or completely replace an existing file. Use for new files and large rewrites; prefer edit_file for small changes to existing files.",
  edit_file:
    "Replace an exact snippet in an existing file. old_string must appear exactly once (include surrounding lines to make it unique) unless replace_all is true. Preferred for targeted changes.",
  delete_file: "Delete a file from the project.",
};

export type ToolSpec = {
  name: ToolName;
  description: string;
  shape: z.ZodRawShape;
  schema: z.ZodObject<z.ZodRawShape>;
};

export const toolSpecs: ToolSpec[] = (Object.keys(shapes) as ToolName[]).map((name) => ({
  name,
  description: descriptions[name],
  shape: shapes[name],
  schema: z.object(shapes[name]).strict(),
}));

// ---- Execution -----------------------------------------------------------------

export type ToolResult = { ok: boolean; text: string };

export interface ProjectTools {
  specs: ToolSpec[];
  execute(name: string, input: unknown): Promise<ToolResult>;
  /** Paths created, edited or deleted during this turn. */
  changedPaths(): string[];
}

function countOccurrences(haystack: string, needle: string) {
  let count = 0;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + needle.length)) count++;
  return count;
}

export function createProjectTools(
  store: ProjectFileStore,
  kit: SiteKit,
  emit: (event: AgentEvent) => void,
): ProjectTools {
  const changed = new Set<string>();
  let calls = 0;

  async function assertCapacity(filePath: string, newContent: string) {
    const bytes = Buffer.byteLength(newContent, "utf8");
    if (bytes > LIMITS.maxFileBytes) {
      throw new ToolInputError(`File is ${bytes} bytes; the limit is ${LIMITS.maxFileBytes}. Split it into smaller files.`);
    }
    const files = await store.list();
    const existing = files.find((f) => f.path === filePath);
    if (!existing && files.length >= LIMITS.maxFiles) {
      throw new ToolInputError(`Project already has ${files.length} files (limit ${LIMITS.maxFiles}).`);
    }
    const total = files.reduce((sum, f) => sum + f.size, 0) - (existing?.size ?? 0) + bytes;
    if (total > LIMITS.maxProjectBytes) {
      throw new ToolInputError(`Project would be ${total} bytes (limit ${LIMITS.maxProjectBytes}).`);
    }
  }

  async function run(name: ToolName, input: Record<string, unknown>): Promise<string> {
    const normalize = (p: unknown) => normalizeProjectPath(String(p), kit.allowedExtensions);

    switch (name) {
      case "list_files": {
        const files = await store.list();
        if (files.length === 0) return "The project is empty.";
        return files.map((f) => `${f.path} (${f.size} bytes)`).join("\n");
      }
      case "read_file": {
        const p = normalize(input.path);
        const content = await store.read(p);
        if (content === null) throw new ToolInputError(`File not found: ${p}`);
        if (content.length > LIMITS.maxReadChars) {
          return content.slice(0, LIMITS.maxReadChars) + `\n\n[truncated: file has ${content.length} characters]`;
        }
        return content;
      }
      case "write_file": {
        const p = normalize(input.path);
        const content = String(input.content);
        await assertCapacity(p, content);
        const existed = (await store.read(p)) !== null;
        await store.write(p, content);
        changed.add(p);
        emit({ type: "file_changed", path: p, op: "write" });
        return `${existed ? "Updated" : "Created"} ${p} (${Buffer.byteLength(content, "utf8")} bytes).`;
      }
      case "edit_file": {
        const p = normalize(input.path);
        const oldString = String(input.old_string);
        const newString = String(input.new_string);
        const current = await store.read(p);
        if (current === null) throw new ToolInputError(`File not found: ${p}. Use write_file to create it.`);
        if (oldString === "") throw new ToolInputError("old_string is empty.");
        if (oldString === newString) throw new ToolInputError("old_string and new_string are identical.");
        const count = countOccurrences(current, oldString);
        if (count === 0) {
          throw new ToolInputError(`old_string was not found in ${p}. Read the file again and copy the exact text.`);
        }
        if (count > 1 && input.replace_all !== true) {
          throw new ToolInputError(
            `old_string matches ${count} places in ${p}. Include more surrounding text to make it unique, or set replace_all.`,
          );
        }
        const next = input.replace_all === true ? current.split(oldString).join(newString) : current.replace(oldString, () => newString);
        await assertCapacity(p, next);
        await store.write(p, next);
        changed.add(p);
        emit({ type: "file_changed", path: p, op: "edit" });
        return `Edited ${p} (${input.replace_all === true ? count : 1} replacement${count > 1 && input.replace_all === true ? "s" : ""}).`;
      }
      case "delete_file": {
        const p = normalize(input.path);
        const removed = await store.delete(p);
        if (!removed) throw new ToolInputError(`File not found: ${p}`);
        changed.add(p);
        emit({ type: "file_changed", path: p, op: "delete" });
        return `Deleted ${p}.`;
      }
    }
  }

  return {
    specs: toolSpecs,
    changedPaths: () => [...changed],
    async execute(name, rawInput) {
      const spec = toolSpecs.find((s) => s.name === name);
      if (!spec) return { ok: false, text: `Unknown tool: ${name}` };

      if (++calls > LIMITS.maxToolCallsPerTurn) {
        const message = `Tool call limit (${LIMITS.maxToolCallsPerTurn}) reached for this turn. Stop calling tools and summarise what you did.`;
        emit({ type: "tool_error", tool: name, message });
        return { ok: false, text: message };
      }

      // Validate before running: streamed tool inputs are not validated by the API.
      const parsed = spec.schema.safeParse(rawInput ?? {});
      if (!parsed.success) {
        const message = `Invalid input for ${name}: ${parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`;
        emit({ type: "tool_error", tool: name, message });
        return { ok: false, text: JSON.stringify({ INVALID_JSON: JSON.stringify(rawInput), error: message }) };
      }

      const input = parsed.data as Record<string, unknown>;
      emit({ type: "tool_start", tool: name, input: summarizeInput(input) });
      try {
        return { ok: true, text: await run(spec.name, input) };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit({ type: "tool_error", tool: name, message });
        return { ok: false, text: message };
      }
    },
  };
}

/** Keeps events small: file bodies are replaced by their length. */
function summarizeInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = typeof value === "string" && value.length > 120 ? `[${value.length} chars]` : value;
  }
  return out;
}
