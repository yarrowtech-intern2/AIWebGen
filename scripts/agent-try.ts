/**
 * M1 smoke test: run the agent from the terminal and write the site to disk.
 *
 *   npm run agent:try -- "a landing page for a bakery in Kolkata"
 *   npm run agent:try -- "make the hero darker"            # follow-up edit, same folder
 *   npm run agent:try -- --kit react-vite --fresh "a portfolio for a photographer"
 *   npm run agent:try -- --provider anthropic-api "..."     # override AI_PROVIDER
 *
 * Options: --kit static|react-vite  --out <dir> (default .tmp-site)  --fresh  --provider <id>
 */
import "dotenv/config";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { getKit } from "@/kits";
import { loadAiConfig, runAgentTurn, type ChatTurn } from "@/server/ai";
import { MemoryFileStore } from "@/server/projects/file-store";

const STATE_FILE = ".agent-session.json";
type SessionState = { kit: string; history: ChatTurn[] };

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

async function readTree(dir: string, base = dir): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(files, await readTree(full, base));
    else if (entry.name !== STATE_FILE) {
      files[path.relative(base, full).split(path.sep).join("/")] = await readFile(full, "utf8");
    }
  }
  return files;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      kit: { type: "string" },
      out: { type: "string", default: ".tmp-site" },
      fresh: { type: "boolean", default: false },
      provider: { type: "string" },
    },
  });

  const prompt = positionals.join(" ").trim();
  if (!prompt) {
    console.error('Usage: npm run agent:try -- [--kit static|react-vite] [--fresh] "describe your site"');
    process.exit(1);
  }

  const outDir = path.resolve(values.out!);
  const statePath = path.join(outDir, STATE_FILE);
  const resume = !values.fresh && existsSync(statePath);
  const state: SessionState = resume
    ? JSON.parse(await readFile(statePath, "utf8"))
    : { kit: values.kit ?? "static", history: [] };
  if (resume && values.kit && values.kit !== state.kit) {
    console.error(red(`${outDir} holds a "${state.kit}" project; use --fresh to start a "${values.kit}" one.`));
    process.exit(1);
  }

  const kit = getKit(state.kit);
  const store = new MemoryFileStore(resume ? await readTree(outDir) : kit.starterFiles);
  const config = loadAiConfig({ ...process.env, ...(values.provider ? { AI_PROVIDER: values.provider } : {}) });

  console.log(dim(`provider=${config.provider} model=${config.model} effort=${config.effort} kit=${kit.id} ${resume ? "(continuing session)" : "(new project)"}`));
  console.log(dim(`> ${prompt}\n`));

  const abort = new AbortController();
  process.on("SIGINT", () => abort.abort());

  let finalText = "";
  let failed = false;
  let lastWasText = false;
  const started = Date.now();

  for await (const event of runAgentTurn({ store, kit, history: state.history, userMessage: prompt, signal: abort.signal, config })) {
    switch (event.type) {
      case "text_delta":
        process.stdout.write(event.text);
        lastWasText = true;
        break;
      case "tool_start": {
        const target = typeof event.input.path === "string" ? ` ${event.input.path}` : "";
        process.stdout.write(`${lastWasText ? "\n" : ""}${dim(`  → ${event.tool}${target}`)}\n`);
        lastWasText = false;
        break;
      }
      case "tool_error":
        process.stdout.write(`${red(`  ✗ ${event.tool}: ${event.message}`)}\n`);
        break;
      case "usage":
        console.log(
          dim(
            `\n\ntokens: in ${event.inputTokens} (+${event.cacheReadTokens ?? 0} cached) / out ${event.outputTokens}` +
              (event.costUsd !== undefined ? ` · est. $${event.costUsd.toFixed(4)}` : "") +
              ` · ${((Date.now() - started) / 1000).toFixed(1)}s`,
          ),
        );
        break;
      case "done":
        finalText = event.text;
        break;
      case "error":
        failed = true;
        console.error(red(`\nError: ${event.message}`));
        break;
    }
  }

  // Mirror the virtual project to disk (rewrite the folder so deletions show up).
  const snapshot = await store.snapshot();
  await rm(outDir, { recursive: true, force: true });
  for (const [file, content] of Object.entries(snapshot)) {
    const target = path.join(outDir, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
  state.history.push({ role: "user", text: prompt });
  state.history.push({ role: "assistant", text: finalText || (failed ? "(turn failed)" : "(no reply)") });
  await mkdir(outDir, { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");

  console.log(green(`\n${Object.keys(snapshot).length} files in ${outDir}`));
  if (kit.id === "static") console.log(dim(`Open ${path.join(outDir, "index.html")} in a browser.`));
  else console.log(dim(`cd ${values.out} && npm install && npm run dev`));
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(red(err instanceof Error ? err.stack ?? err.message : String(err)));
  process.exit(1);
});
