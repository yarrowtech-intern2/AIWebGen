import path from "node:path";
import { getCurrentUser, getFile, getProject } from "@/server/projects/service";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

const notFoundPage = (p: string) =>
  `<!doctype html><meta charset="utf-8"><title>Not found</title>
<body style="font-family:system-ui;padding:3rem;color:#555">
<h1 style="font-size:1.25rem">Page not found</h1><p><code>${p.replace(/[<>&"]/g, "")}</code> doesn't exist in this project yet.</p></body>`;

/**
 * Serves a Static-kit project's files for the live preview iframe.
 * Generated code is untrusted: every HTML response carries a CSP `sandbox`
 * (no same-origin), so even when opened directly in a tab it cannot read
 * the builder's cookies or call its API as the user.
 */
export async function GET(_req: Request, ctx: RouteContext<"/preview/[id]/[[...path]]">) {
  const { id, path: segments } = await ctx.params;
  const user = await getCurrentUser(); // M3: replace with a signed preview token
  const project = await getProject(user.id, id);
  if (!project) return new Response("Not found", { status: 404 });

  let filePath = (segments ?? []).map((s) => decodeURIComponent(s)).join("/");
  if (filePath === "" || filePath.endsWith("/")) filePath += "index.html";
  if (filePath.split("/").some((s) => s === ".." || s === ".")) return new Response("Bad path", { status: 400 });

  let file = await getFile(id, filePath);
  // Allow extensionless links like /about -> about.html
  if (!file && !path.posix.extname(filePath)) file = await getFile(id, `${filePath}.html`);

  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    // The sandboxed iframe has an opaque origin; module scripts and fetch() need CORS.
    "Access-Control-Allow-Origin": "*",
  };

  if (!file) {
    return new Response(notFoundPage(filePath), {
      status: 404,
      headers: { ...headers, "Content-Type": CONTENT_TYPES[".html"], "Content-Security-Policy": "sandbox" },
    });
  }

  const ext = path.posix.extname(file.path).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "text/plain; charset=utf-8";
  if (ext === ".html" || ext === ".svg") {
    headers["Content-Security-Policy"] = "sandbox allow-scripts allow-forms allow-popups allow-modals";
  }
  return new Response(file.content, { headers: { ...headers, "Content-Type": contentType } });
}
