import "server-only";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Starter templates live in templates/<kit>/<slug>/ (generated with
 * scripts/generate-templates.sh and reviewed by hand). The catalogue in
 * templates/catalog.json holds names and descriptions.
 */
const ROOT = path.join(process.cwd(), "templates");
const SLUG = /^[a-z0-9-]{1,60}$/;

type CatalogEntry = { name: string; description: string };

export type TemplateInfo = { slug: string; name: string; description: string; kits: string[] };

async function readCatalog(): Promise<Record<string, CatalogEntry>> {
  try {
    return JSON.parse(await readFile(path.join(ROOT, "catalog.json"), "utf8"));
  } catch {
    return {};
  }
}

export async function listTemplates(): Promise<TemplateInfo[]> {
  const catalog = await readCatalog();
  return Object.entries(catalog)
    .map(([slug, entry]) => ({
      slug,
      ...entry,
      kits: ["static", "react-vite"].filter((kit) => existsSync(path.join(ROOT, kit, slug, "index.html"))),
    }))
    .filter((t) => t.kits.length > 0);
}

async function readTree(dir: string, base = dir): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(files, await readTree(full, base));
    else files[path.relative(base, full).split(path.sep).join("/")] = await readFile(full, "utf8");
  }
  return files;
}

/** The template's files, or null if it doesn't exist for this kit. */
export async function loadTemplateFiles(kit: string, slug: string): Promise<Record<string, string> | null> {
  if (!SLUG.test(slug) || !SLUG.test(kit)) return null;
  const dir = path.join(ROOT, kit, slug);
  if (!existsSync(path.join(dir, "index.html"))) return null;
  return readTree(dir);
}
