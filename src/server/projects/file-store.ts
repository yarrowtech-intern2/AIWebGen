/**
 * The virtual project file system the agent works on. The agent never touches
 * the real disk; a DB-backed implementation arrives in M2/M3.
 */
export interface ProjectFileStore {
  list(): Promise<{ path: string; size: number }[]>;
  read(path: string): Promise<string | null>;
  write(path: string, content: string): Promise<void>;
  delete(path: string): Promise<boolean>;
  snapshot(): Promise<Record<string, string>>;
}

export class MemoryFileStore implements ProjectFileStore {
  private files = new Map<string, string>();

  constructor(initial: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(initial)) this.files.set(path, content);
  }

  async list() {
    return [...this.files.entries()]
      .map(([path, content]) => ({ path, size: Buffer.byteLength(content, "utf8") }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async read(path: string) {
    return this.files.get(path) ?? null;
  }

  async write(path: string, content: string) {
    this.files.set(path, content);
  }

  async delete(path: string) {
    return this.files.delete(path);
  }

  async snapshot() {
    return Object.fromEntries(this.files);
  }
}
