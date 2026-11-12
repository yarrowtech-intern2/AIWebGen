import "server-only";
import { db } from "@/server/db";
import type { ProjectFileStore } from "./file-store";

/**
 * Database-backed working copy of a project. Writes go straight to the DB so
 * the live preview picks them up while the agent is still working.
 */
export class DbFileStore implements ProjectFileStore {
  constructor(private projectId: string) {}

  async list() {
    const rows = await db.projectFile.findMany({
      where: { projectId: this.projectId },
      select: { path: true, content: true },
      orderBy: { path: "asc" },
    });
    return rows.map((r) => ({ path: r.path, size: Buffer.byteLength(r.content, "utf8") }));
  }

  async read(path: string) {
    const row = await db.projectFile.findUnique({
      where: { projectId_path: { projectId: this.projectId, path } },
      select: { content: true },
    });
    return row?.content ?? null;
  }

  async write(path: string, content: string) {
    await db.projectFile.upsert({
      where: { projectId_path: { projectId: this.projectId, path } },
      update: { content },
      create: { projectId: this.projectId, path, content },
    });
  }

  async delete(path: string) {
    const { count } = await db.projectFile.deleteMany({ where: { projectId: this.projectId, path } });
    return count > 0;
  }

  async snapshot() {
    const rows = await db.projectFile.findMany({
      where: { projectId: this.projectId },
      select: { path: true, content: true },
    });
    return Object.fromEntries(rows.map((r) => [r.path, r.content]));
  }
}
