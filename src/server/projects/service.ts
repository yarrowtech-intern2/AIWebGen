import "server-only";
import { getKit } from "@/kits";
import type { ChatTurn } from "@/server/ai/types";
import { LIMITS, normalizeProjectPath, ToolInputError } from "@/server/ai/tools";
import { db } from "@/server/db";

const DEMO_EMAIL = "demo@example.com";

/**
 * M2: everything belongs to the seeded demo user.
 * M3 replaces this with the Auth.js session user.
 */
export async function getCurrentUser() {
  return db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: "Demo User", passwordHash: "UNSET-until-M3" },
  });
}

export async function listProjects(userId: string) {
  return db.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, kit: true, updatedAt: true, _count: { select: { files: true } } },
  });
}

export async function createProject(userId: string, input: { name: string; kit: string }) {
  const kit = getKit(input.kit);
  return db.project.create({
    data: {
      userId,
      name: input.name,
      kit: kit.id,
      files: {
        create: Object.entries(kit.starterFiles).map(([path, content]) => ({ path, content })),
      },
    },
    select: { id: true },
  });
}

/** Returns the project only if it belongs to the user. */
export async function getProject(userId: string, projectId: string) {
  return db.project.findFirst({ where: { id: projectId, userId } });
}

export async function deleteProject(userId: string, projectId: string) {
  const { count } = await db.project.deleteMany({ where: { id: projectId, userId } });
  return count > 0;
}

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

/** Manual save from the code editor. Same path and size rules as the agent's tools. */
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
  return path;
}

export async function touchProject(projectId: string) {
  await db.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
}

// ---- Chat ----------------------------------------------------------------------

export type StoredAssistantMeta = { changedFiles?: string[]; error?: string };

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
) {
  return db.chatMessage.create({
    data: { projectId, role, content, raw: meta ? JSON.stringify(meta) : null },
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
