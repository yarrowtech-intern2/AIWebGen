import "server-only";
import { getKit } from "@/kits";
import type { ChatTurn } from "@/server/ai/types";
import { LIMITS, normalizeProjectPath, ToolInputError } from "@/server/ai/tools";
import { db } from "@/server/db";
import { loadTemplateFiles } from "./templates";

// ---- Projects --------------------------------------------------------------------

export async function listProjects(userId: string) {
  return db.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, kit: true, updatedAt: true, _count: { select: { files: true } } },
  });
}

export async function createProject(userId: string, input: { name: string; kit: string; template?: string }) {
  const kit = getKit(input.kit);
  const templateFiles = input.template ? await loadTemplateFiles(kit.id, input.template) : null;
  const files = templateFiles ?? kit.starterFiles;
  const project = await db.project.create({
    data: {
      userId,
      name: input.name,
      kit: kit.id,
      templateSlug: templateFiles ? input.template : null,
      files: {
        create: Object.entries(files).map(([path, content]) => ({ path, content })),
      },
    },
    select: { id: true },
  });
  await createVersion(project.id, "template", templateFiles ? `Template: ${input.name}` : "Starter files");
  return project;
}

/** Returns the project only if it belongs to the user. */
export async function getProject(userId: string, projectId: string) {
  return db.project.findFirst({ where: { id: projectId, userId } });
}

/** Kit of a project, without an ownership check (callers must have authorised access). */
export async function getProjectKit(projectId: string) {
  return (await db.project.findUnique({ where: { id: projectId }, select: { kit: true } }))?.kit ?? null;
}

export async function renameProject(projectId: string, name: string) {
  await db.project.update({ where: { id: projectId }, data: { name } });
}

export async function deleteProject(userId: string, projectId: string) {
  const { count } = await db.project.deleteMany({ where: { id: projectId, userId } });
  return count > 0;
}

export async function touchProject(projectId: string) {
  await db.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
}

// ---- Files -----------------------------------------------------------------------

export async function listFiles(projectId: string) {
  return db.projectFile.findMany({
    where: { projectId },
    select: { path: true, content: true },
    orderBy: { path: "asc" },
  });
}

export async function getFile(projectId: string, path: string) {
  return db.projectFile.findUnique({ where: { projectId_path: { projectId, path } } });
}

const MANUAL_COALESCE_MS = 2 * 60 * 1000;

/**
 * Manual save from the code editor. Same path and size rules as the agent's tools.
 * Repeated saves of the same file within 2 minutes update one version instead of
 * creating a new one per Ctrl+S.
 */
export async function saveFile(project: { id: string; kit: string }, rawPath: string, content: string) {
  const path = normalizeProjectPath(rawPath, getKit(project.kit).allowedExtensions);
  if (Buffer.byteLength(content, "utf8") > LIMITS.maxFileBytes) {
    throw new ToolInputError(`File is larger than ${LIMITS.maxFileBytes} bytes.`);
  }
  await db.projectFile.upsert({
    where: { projectId_path: { projectId: project.id, path } },
    update: { content },
    create: { projectId: project.id, path, content },
  });
  await touchProject(project.id);

  const summary = `Edited ${path}`;
  const latest = await db.version.findFirst({ where: { projectId: project.id }, orderBy: { number: "desc" } });
  if (latest && latest.source === "manual" && latest.summary === summary && Date.now() - latest.createdAt.getTime() < MANUAL_COALESCE_MS) {
    await db.version.update({ where: { id: latest.id }, data: { snapshot: JSON.stringify(await snapshotFiles(project.id)) } });
  } else {
    await createVersion(project.id, "manual", summary);
  }
  return path;
}

// ---- Versions --------------------------------------------------------------------

export type VersionSource = "ai" | "manual" | "template" | "restore";

async function snapshotFiles(projectId: string) {
  const files = await listFiles(projectId);
  return Object.fromEntries(files.map((f) => [f.path, f.content]));
}

/** Snapshots the current working copy as the next version number. */
export async function createVersion(projectId: string, source: VersionSource, summary: string) {
  const snapshot = JSON.stringify(await snapshotFiles(projectId));
  return db.$transaction(async (tx) => {
    const last = await tx.version.findFirst({ where: { projectId }, orderBy: { number: "desc" }, select: { number: true } });
    const version = await tx.version.create({
      data: { projectId, number: (last?.number ?? 0) + 1, source, summary: summary.slice(0, 200), snapshot },
      select: { id: true, number: true },
    });
    await tx.project.update({ where: { id: projectId }, data: { currentVersionId: version.id } });
    return version;
  });
}

export async function listVersions(projectId: string) {
  return db.version.findMany({
    where: { projectId },
    orderBy: { number: "desc" },
    select: { id: true, number: true, source: true, summary: true, createdAt: true },
  });
}

/** Replaces the working copy with a version's files and records the restore as a new version. */
export async function restoreVersion(projectId: string, versionId: string) {
  const version = await db.version.findFirst({ where: { id: versionId, projectId } });
  if (!version) return null;
  const files = JSON.parse(version.snapshot) as Record<string, string>;
  await db.$transaction([
    db.projectFile.deleteMany({ where: { projectId } }),
    db.projectFile.createMany({ data: Object.entries(files).map(([path, content]) => ({ projectId, path, content })) }),
    db.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } }),
  ]);
  return createVersion(projectId, "restore", `Restored v${version.number}`);
}

// ---- Chat ------------------------------------------------------------------------

export type StoredAssistantMeta = { changedFiles?: string[]; error?: string; versionNumber?: number };

export async function listMessages(projectId: string) {
  return db.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, raw: true, createdAt: true },
  });
}

export async function addMessage(
  projectId: string,
  role: "user" | "assistant",
  content: string,
  meta?: StoredAssistantMeta,
  versionId?: string,
) {
  return db.chatMessage.create({
    data: { projectId, role, content, raw: meta ? JSON.stringify(meta) : null, versionId },
    select: { id: true },
  });
}

/** Recent turns as provider-neutral history; file changes are noted so Claude knows what it did. */
export async function getChatHistory(projectId: string, maxMessages = 30): Promise<ChatTurn[]> {
  const rows = await db.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: maxMessages,
    select: { role: true, content: true, raw: true },
  });
  return rows.reverse().map((row) => {
    let text = row.content;
    if (row.role === "assistant" && row.raw) {
      const meta = JSON.parse(row.raw) as StoredAssistantMeta;
      if (meta.changedFiles?.length) text += `\n\n[Files changed: ${meta.changedFiles.join(", ")}]`;
      if (meta.error) text += `\n\n[This turn ended with an error: ${meta.error}]`;
    }
    return { role: row.role as ChatTurn["role"], text: text || "(no reply)" };
  });
}
