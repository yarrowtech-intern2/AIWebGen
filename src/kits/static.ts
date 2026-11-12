import type { SiteKit } from "./types";

const starterIndex = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>New site</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="css/styles.css" />
</head>
<body class="min-h-screen bg-white text-slate-900 antialiased">
  <main class="mx-auto max-w-3xl px-6 py-24 text-center">
    <h1 class="text-4xl font-bold tracking-tight">Your site starts here</h1>
    <p class="mt-4 text-slate-600">Describe what you want and the AI will build it.</p>
  </main>
  <script src="js/main.js"></script>
</body>
</html>
`;

export const staticKit: SiteKit = {
  id: "static",
  label: "Static (HTML + Tailwind)",
  description: "Plain HTML pages styled with Tailwind via CDN. No build step; opens anywhere.",
  starterFiles: {
    "index.html": starterIndex,
    "css/styles.css": "/* Custom styles that Tailwind utilities don't cover. */\n",
    "js/main.js": "// Page interactivity goes here.\n",
  },
  allowedExtensions: [".html", ".css", ".js", ".json", ".svg", ".txt", ".md", ".xml", ".webmanifest"],
  preview: { type: "static-server" },
  systemPrompt: `## Kit: Static HTML + Tailwind
- Every page is a standalone .html file at the project root (index.html is the home page). Link pages with relative URLs (e.g. "about.html").
- Load Tailwind with <script src="https://cdn.tailwindcss.com"></script> in every page's <head>. You may configure it with an inline \`tailwind.config = {...}\` script for custom colours/fonts.
- Put custom CSS in css/styles.css and JavaScript in js/main.js (or other files under js/). Vanilla JS only; no build tools, no npm packages.
- Google Fonts via <link> are fine. Use inline SVG for icons and illustrations.
- Images: use https://images.unsplash.com/... or https://picsum.photos/... URLs with sensible width parameters and meaningful alt text. Never reference local image files that don't exist.
- Keep shared sections (header/footer) consistent across pages; when you change one, update it on every page.`,
  exportReadme: `# Static site

Open \`index.html\` in a browser, or serve the folder with any static host
(Netlify, Vercel, GitHub Pages, S3, nginx…). No build step is required.
`,
};
