import "server-only";
import JSZip from "jszip";
import { getKit } from "@/kits";

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .slice(0, 50) || "my-site"
  );
}

/**
 * The project as it should look outside the builder: its files plus a README
 * and, for React, a .gitignore (unless Claude already wrote them).
 * Used by ZIP export and GitHub/Vercel publishing.
 */
export function exportFiles(project: { name: string; kit: string }, files: Record<string, string>): Record<string, string> {
  const kit = getKit(project.kit);
  const out = { ...files };
  if (!out["README.md"]) out["README.md"] = `# ${project.name}\n\nBuilt with AgentWebBuilder.\n\n${kit.exportReadme}`;
  if (kit.id === "react-vite" && !out[".gitignore"]) out[".gitignore"] = "node_modules\ndist\n.env\n";
  return out;
}

export async function buildZip(project: { name: string; kit: string }, files: Record<string, string>) {
  const zip = new JSZip();
  const folder = zip.folder(slugify(project.name))!;
  for (const [path, content] of Object.entries(exportFiles(project, files))) folder.file(path, content);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
