import type { SiteKit } from "./types";

const packageJson = JSON.stringify(
  {
    name: "my-site",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
    devDependencies: {
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      "@vitejs/plugin-react": "^5.0.0",
      typescript: "^5.6.0",
      vite: "^7.0.0",
    },
  },
  null,
  2,
);

export const reactViteKit: SiteKit = {
  id: "react-vite",
  label: "React (Vite + TypeScript)",
  description: "A React single-page app with components. Runs with npm install && npm run dev.",
  starterFiles: {
    "package.json": packageJson + "\n",
    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New site</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    "vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
`,
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ["src"],
      },
      null,
      2,
    ) + "\n",
    "src/main.tsx": `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
    "src/App.tsx": `export default function App() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Your site starts here</h1>
      <p className="mt-4 text-slate-600">Describe what you want and the AI will build it.</p>
    </main>
  );
}
`,
    "src/index.css": "/* Global styles. Tailwind utilities are available via the CDN script in index.html. */\n",
  },
  allowedExtensions: [".tsx", ".ts", ".jsx", ".js", ".css", ".html", ".json", ".svg", ".md", ".txt"],
  preview: { type: "sandpack", template: "vite-react-ts" },
  systemPrompt: `## Kit: React + Vite + TypeScript
- Entry is src/main.tsx rendering <App /> from src/App.tsx. Put components in src/components/ (one component per file, PascalCase names) and page sections as separate components.
- Style with Tailwind utility classes (Tailwind is loaded via CDN in index.html; do not add a Tailwind build setup). Extra global CSS goes in src/index.css.
- Use function components and hooks, typed with TypeScript. No class components.
- Only depend on react and react-dom. If you truly need another npm package, add it to package.json "dependencies" with a caret version, and keep the number of packages small (the preview installs them in the browser).
- For multiple "pages", use simple state- or hash-based navigation in App.tsx instead of adding a router package, unless the user asks for one.
- Images: https://images.unsplash.com/... or https://picsum.photos/... URLs with alt text. Icons as inline SVG components.`,
  exportReadme: `# React site (Vite)

\`\`\`bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
\`\`\`
`,
};
