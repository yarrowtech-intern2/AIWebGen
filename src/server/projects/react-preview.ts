import "server-only";
import { createHash } from "node:crypto";
import path from "node:path";
import * as esbuild from "esbuild";

/**
 * Builds a React (Vite-style) project for the live preview, entirely on the
 * server and in memory: esbuild bundles the project's own files, and npm
 * packages are left as bare imports that an import map resolves to esm.sh in
 * the browser. The exported project still builds with real Vite.
 */

export type ReactBuild =
  | { ok: true; js: string; css: string; importMap: Record<string, string> }
  | { ok: false; errors: string[] };

const EXTENSIONS = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"];
const LOADERS: Record<string, esbuild.Loader> = {
  ".tsx": "tsx",
  ".ts": "ts",
  ".jsx": "jsx",
  ".js": "js",
  ".css": "css",
  ".json": "json",
  ".svg": "dataurl",
  ".md": "text",
  ".txt": "text",
};

// Cache the last build per project; most preview requests hit an unchanged project.
const globalForBuilds = globalThis as unknown as { reactBuilds?: Map<string, { hash: string; build: ReactBuild }> };
const cache = (globalForBuilds.reactBuilds ??= new Map());

const hashFiles = (files: Record<string, string>) =>
  createHash("sha1").update(JSON.stringify(Object.entries(files).sort())).digest("hex");

/** Finds the entry module from index.html's <script type="module" src=…>, defaulting to src/main.tsx. */
export function findEntry(files: Record<string, string>): string {
  const match = files["index.html"]?.match(/<script[^>]*type=["']module["'][^>]*src=["']\/?([^"']+)["']/i);
  const candidate = match?.[1];
  return candidate && candidate in files ? candidate : "src/main.tsx";
}

function packageName(specifier: string) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/** "^19.0.0" -> "19.0.0"; anything unusual -> "latest" handling is left to esm.sh. */
function cleanVersion(range: string | undefined) {
  if (!range) return undefined;
  const m = range.match(/\d+(\.\d+){0,2}(-[\w.]+)?/);
  return m?.[0];
}

export function esmUrl(specifier: string, deps: Record<string, string>) {
  const name = packageName(specifier);
  const subpath = specifier.slice(name.length);
  const version = cleanVersion(deps[name]) ?? (name === "react" || name === "react-dom" ? "19" : undefined);
  const pkg = version ? `${name}@${version}` : name;
  // One shared React for everything: other packages treat react/react-dom as external.
  const external = name === "react" ? "" : name === "react-dom" ? "?external=react" : "?external=react,react-dom";
  return `https://esm.sh/${pkg}${subpath}${external}`;
}

export async function buildReactPreview(projectId: string, files: Record<string, string>): Promise<ReactBuild> {
  const hash = hashFiles(files);
  const cached = cache.get(projectId);
  if (cached?.hash === hash) return cached.build;

  let deps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(files["package.json"] ?? "{}");
    deps = { ...pkg.devDependencies, ...pkg.dependencies };
  } catch {
    // A broken package.json shouldn't stop the preview; fall back to defaults.
  }

  const bareImports = new Set<string>(["react", "react-dom", "react-dom/client", "react/jsx-runtime"]);
  const entry = findEntry(files);

  const virtualFs: esbuild.Plugin = {
    name: "project-files",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === "entry-point") return { path: args.path, namespace: "project" };
        const spec = args.path;
        if (/^https?:\/\//.test(spec)) return { path: spec, external: true };
        if (spec.startsWith(".") || spec.startsWith("/")) {
          const base = spec.startsWith("/") ? "" : path.posix.dirname(args.importer);
          const joined = path.posix.normalize(path.posix.join(base, spec)).replace(/^\/+/, "");
          for (const ext of EXTENSIONS) {
            if (joined + ext in files) return { path: joined + ext, namespace: "project" };
          }
          return { errors: [{ text: `Cannot find "${spec}" (imported from ${args.importer})` }] };
        }
        // Bare npm import: resolved in the browser through the import map.
        bareImports.add(spec);
        return { path: spec, external: true };
      });
      build.onLoad({ filter: /.*/, namespace: "project" }, (args) => {
        const ext = path.posix.extname(args.path).toLowerCase();
        const loader = LOADERS[ext];
        if (!loader) return { errors: [{ text: `Unsupported file type: ${args.path}` }] };
        const contents = files[args.path];
        return { contents: loader === "dataurl" ? Buffer.from(contents, "utf8") : contents, loader, resolveDir: "/" };
      });
    },
  };

  let result: ReactBuild;
  try {
    const out = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: "esm",
      target: "es2022",
      jsx: "automatic",
      outdir: "/out",
      logLevel: "silent",
      define: { "process.env.NODE_ENV": '"development"', "import.meta.env.DEV": "true", "import.meta.env.PROD": "false" },
      plugins: [virtualFs],
    });
    const js = out.outputFiles.find((f) => f.path.endsWith(".js"))?.text ?? "";
    const css = out.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "";
    const importMap = Object.fromEntries([...bareImports].sort().map((s) => [s, esmUrl(s, deps)]));
    result = { ok: true, js, css, importMap };
  } catch (err) {
    const failure = err as esbuild.BuildFailure;
    const errors = failure.errors?.length
      ? failure.errors.map((e) =>
          e.location ? `${e.location.file.replace(/^project:/, "")}:${e.location.line}:${e.location.column}: ${e.text}\n  ${e.location.lineText}` : e.text,
        )
      : [err instanceof Error ? err.message : String(err)];
    result = { ok: false, errors };
  }

  cache.set(projectId, { hash, build: result });
  if (cache.size > 50) cache.delete(cache.keys().next().value!);
  return result;
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** index.html with the dev entry script swapped for the bundle and an import map. */
export function renderReactIndex(indexHtml: string, build: Extract<ReactBuild, { ok: true }>, assetBase: string) {
  const head = [
    `<script type="importmap">${JSON.stringify({ imports: build.importMap }).replace(/</g, "\\u003c")}</script>`,
    build.css ? `<link rel="stylesheet" href="${assetBase}/bundle.css">` : "",
  ].join("\n");
  const html = indexHtml.replace(/<script[^>]*type=["']module["'][^>]*src=["'][^"']+["'][^>]*>\s*<\/script>/gi, "");
  const withHead = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${head}\n</head>`) : head + html;
  const script = `<script type="module" src="${assetBase}/bundle.js"></script>`;
  return /<\/body>/i.test(withHead) ? withHead.replace(/<\/body>/i, `${script}\n</body>`) : withHead + script;
}

export function renderBuildErrorPage(errors: string[]) {
  return `<!doctype html><meta charset="utf-8"><title>Build error</title>
<body style="font-family:system-ui;margin:0;padding:2rem;background:#fff5f5;color:#7f1d1d">
<h1 style="font-size:1.1rem;margin:0 0 .5rem">The preview couldn't be built</h1>
<p style="margin:0 0 1rem;color:#991b1b">Use “Ask Claude to fix” in the builder, or fix it in the Code tab.</p>
<pre style="white-space:pre-wrap;background:#fff;border:1px solid #fecaca;border-radius:8px;padding:1rem;font-size:13px">${escapeHtml(errors.join("\n\n"))}</pre></body>`;
}
