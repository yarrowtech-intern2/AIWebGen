import path from "node:path";
import { verifyPreviewToken } from "@/server/projects/preview-token";
import { buildReactPreview, renderBuildErrorPage, renderReactIndex } from "@/server/projects/react-preview";
import { getFile, getProjectKit, listFiles } from "@/server/projects/service";

const BUNDLE_DIR = "__awb";

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

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  // The sandboxed iframe has an opaque origin; module scripts and fetch() need CORS.
  "Access-Control-Allow-Origin": "*",
};

const messagePage = (title: string, detail: string) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font-family:system-ui;padding:3rem;color:#555">
<h1 style="font-size:1.25rem">${title}</h1><p>${detail.replace(/[<>&"]/g, "")}</p></body>`;

function htmlResponse(status: number, body: string) {
  return new Response(body, {
    status,
    headers: { ...BASE_HEADERS, "Content-Type": CONTENT_TYPES[".html"], "Content-Security-Policy": "sandbox" },
  });
}

/**
 * Serves a Static-kit project's files for the live preview iframe.
 *
 * Authorisation is the signed token in the path (the sandboxed iframe sends no
 * cookies). Generated code is untrusted: HTML responses carry a CSP `sandbox`
 * without same-origin, so even opened in its own tab a page can't read the
 * builder's cookies or call its API as the user.
 */
export async function GET(_req: Request, ctx: RouteContext<"/preview/[token]/[[...path]]">) {
  const { token, path: segments } = await ctx.params;
  const projectId = verifyPreviewToken(token);
  if (!projectId) {
    return htmlResponse(403, messagePage("Preview link expired", "Reload the builder to get a fresh preview link."));
  }

  let filePath = (segments ?? []).map((s) => decodeURIComponent(s)).join("/");
  if (filePath === "" || filePath.endsWith("/")) filePath += "index.html";
  if (filePath.split("/").some((s) => s === ".." || s === ".")) return new Response("Bad path", { status: 400 });

  const kit = await getProjectKit(projectId);
  if (!kit) return htmlResponse(404, messagePage("Project not found", "This project no longer exists."));

  // React projects: index.html and the bundle are produced by the in-memory build.
  if (kit === "react-vite" && (filePath === "index.html" || filePath.startsWith(`${BUNDLE_DIR}/`))) {
    const files = Object.fromEntries((await listFiles(projectId)).map((f) => [f.path, f.content]));
    const build = await buildReactPreview(projectId, files);
    if (!build.ok) return htmlResponse(200, renderBuildErrorPage(build.errors));
    if (filePath === `${BUNDLE_DIR}/bundle.js`) {
      return new Response(build.js, { headers: { ...BASE_HEADERS, "Content-Type": CONTENT_TYPES[".js"] } });
    }
    if (filePath === `${BUNDLE_DIR}/bundle.css`) {
      return new Response(build.css, { headers: { ...BASE_HEADERS, "Content-Type": CONTENT_TYPES[".css"] } });
    }
    if (filePath === "index.html" && files["index.html"]) {
      const html = renderReactIndex(files["index.html"], build, `/preview/${token}/${BUNDLE_DIR}`);
      return new Response(html, {
        headers: {
          ...BASE_HEADERS,
          "Content-Type": CONTENT_TYPES[".html"],
          "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups allow-modals",
        },
      });
    }
  }

  let file = await getFile(projectId, filePath);
  // Allow extensionless links like /about -> about.html
  if (!file && !path.posix.extname(filePath)) file = await getFile(projectId, `${filePath}.html`);
  if (!file) return htmlResponse(404, messagePage("Page not found", `${filePath} doesn't exist in this project yet.`));

  const ext = path.posix.extname(file.path).toLowerCase();
  const headers: Record<string, string> = {
    ...BASE_HEADERS,
    "Content-Type": CONTENT_TYPES[ext] ?? "text/plain; charset=utf-8",
  };
  if (ext === ".html" || ext === ".svg") {
    headers["Content-Security-Policy"] = "sandbox allow-scripts allow-forms allow-popups allow-modals";
  }
  return new Response(file.content, { headers });
}
