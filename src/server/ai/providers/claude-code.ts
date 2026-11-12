import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk";
import type { AgentEvent, AgentProvider, AgentRunRequest, AiConfig } from "../types";

const MCP_SERVER = "project";

/**
 * LOCAL TESTING provider: Claude Agent SDK authenticated with the developer's
 * Claude Code login (no API key). Not for serving end users; production must
 * use the anthropic-api provider.
 */
export class ClaudeCodeProvider implements AgentProvider {
  readonly id = "claude-code" as const;

  constructor(private config: AiConfig) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_CLAUDE_CODE_PROVIDER !== "1") {
      throw new Error(
        'AI_PROVIDER=claude-code is for local testing only. Use AI_PROVIDER=anthropic-api in production.',
      );
    }
  }

  async run(req: AgentRunRequest, emit: (event: AgentEvent) => void): Promise<void> {
    // Our project tools, exposed as an in-process MCP server.
    const server = createSdkMcpServer({
      name: MCP_SERVER,
      version: "1.0.0",
      tools: req.tools.specs.map((spec) =>
        tool(spec.name, spec.description, spec.shape, async (args) => {
          const result = await req.tools.execute(spec.name, args);
          return { content: [{ type: "text" as const, text: result.text }], isError: !result.ok };
        }),
      ),
    });

    const abortController = new AbortController();
    if (req.signal.aborted) abortController.abort();
    req.signal.addEventListener("abort", () => abortController.abort(), { once: true });

    // Use the local Claude Code login, not an API key that may be in .env for the other provider.
    const env: Record<string, string | undefined> = {
      ...process.env,
      CLAUDE_AGENT_SDK_CLIENT_APP: "agentwebbuilder/0.1.0",
    };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;

    // Built-in tools are disabled, but run in an empty scratch dir anyway.
    const sandboxDir = path.join(os.tmpdir(), "agentwebbuilder-agent");
    mkdirSync(sandboxDir, { recursive: true });

    const run = query({
      prompt: buildPrompt(req),
      options: {
        systemPrompt: req.systemPrompt,
        tools: [], // no Bash/Read/Write/WebFetch…: only our project tools
        mcpServers: { [MCP_SERVER]: server },
        allowedTools: req.tools.specs.map((s) => `mcp__${MCP_SERVER}__${s.name}`),
        permissionMode: "dontAsk",
        settingSources: [], // ignore ~/.claude settings and CLAUDE.md files
        persistSession: false,
        includePartialMessages: true,
        model: this.config.model,
        effort: this.config.effort,
        maxTurns: this.config.maxTurns,
        abortController,
        cwd: sandboxDir,
        env,
      },
    });

    let finalText = "";
    for await (const msg of run) {
      if (msg.type === "stream_event" && msg.parent_tool_use_id === null) {
        const event = msg.event;
        if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") emit({ type: "text_delta", text: event.delta.text });
          else if (event.delta.type === "thinking_delta") emit({ type: "thinking_delta", text: event.delta.thinking });
        }
      } else if (msg.type === "result") {
        emit({
          type: "usage",
          inputTokens: msg.usage.input_tokens + (msg.usage.cache_creation_input_tokens ?? 0),
          outputTokens: msg.usage.output_tokens,
          cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
          costUsd: msg.total_cost_usd,
        });
        if (msg.subtype === "success") {
          finalText = msg.result;
        } else if (msg.subtype === "error_max_turns") {
          emit({ type: "error", message: `Stopped after ${this.config.maxTurns} steps. Ask Claude to continue.` });
        } else {
          throw new Error(`Claude Code run failed (${msg.subtype}).`);
        }
      }
    }
    emit({ type: "done", text: finalText.trim() });
  }

  describeError(err: unknown): string | undefined {
    const message = err instanceof Error ? err.message : String(err);
    if (/not logged in|login|authenticat|credential/i.test(message)) {
      return `Claude Code login not found or expired. Run \`claude\` in a terminal and log in, then retry. (${message})`;
    }
    return undefined;
  }
}

/** The Agent SDK session is fresh per turn, so earlier turns are replayed as a transcript. */
function buildPrompt(req: AgentRunRequest): string {
  const parts: string[] = [];
  if (req.history.length > 0) {
    const transcript = req.history
      .map((turn) => `<${turn.role}>\n${turn.text}\n</${turn.role}>`)
      .join("\n");
    parts.push(`<conversation_history>\n${transcript}\n</conversation_history>`);
  }
  parts.push(req.turnContext, req.userMessage);
  return parts.join("\n\n");
}
