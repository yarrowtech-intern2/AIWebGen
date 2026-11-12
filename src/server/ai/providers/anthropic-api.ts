import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { GITHUB_MCP_SERVER, GITHUB_MCP_URL, GITHUB_TOOL_ALLOWLIST } from "../github-mcp";
import type { ToolSpec } from "../tools";
import type { AgentEvent, AgentProvider, AgentRunRequest, AiConfig } from "../types";

/** Converts a tool's zod schema into the JSON Schema the Messages API expects. */
function toInputSchema(spec: ToolSpec): Anthropic.Beta.BetaTool.InputSchema {
  const schema = { ...(z.toJSONSchema(spec.schema) as Record<string, unknown>) };
  delete schema.$schema;
  return schema as Anthropic.Beta.BetaTool.InputSchema;
}

/**
 * Production provider: Anthropic TypeScript SDK with a streaming manual tool loop.
 * Credentials come from ANTHROPIC_API_KEY (or an `ant auth login` profile).
 */
export class AnthropicApiProvider implements AgentProvider {
  readonly id = "anthropic-api" as const;
  private client = new Anthropic();

  constructor(private config: AiConfig) {}

  async run(req: AgentRunRequest, emit: (event: AgentEvent) => void): Promise<void> {
    const tools: Anthropic.Beta.BetaToolUnion[] = req.tools.specs.map((spec) => ({
      name: spec.name,
      description: spec.description,
      input_schema: toInputSchema(spec),
      // Stream large file bodies as they're generated; inputs are validated in tools.execute().
      eager_input_streaming: true,
    }));

    const messages: Anthropic.Beta.BetaMessageParam[] = [
      ...req.history.map((turn) => ({ role: turn.role, content: turn.text })),
      { role: "user", content: `${req.turnContext}\n\n${req.userMessage}` },
    ];

    // GitHub MCP (server-side connector): only allowlisted tools are enabled.
    const mcpServers: Anthropic.Beta.BetaRequestMCPServerURLDefinition[] = [];
    if (req.github) {
      mcpServers.push({ type: "url", url: GITHUB_MCP_URL, name: GITHUB_MCP_SERVER, authorization_token: req.github.token });
      tools.push({
        type: "mcp_toolset",
        mcp_server_name: GITHUB_MCP_SERVER,
        default_config: { enabled: false },
        configs: Object.fromEntries(GITHUB_TOOL_ALLOWLIST.map((name) => [name, { enabled: true }])),
      });
    }

    const useFallbacks = process.env.AI_FALLBACKS !== "off";
    const betas: string[] = [];
    if (useFallbacks) betas.push("server-side-fallback-2026-07-01");
    if (req.github) betas.push("mcp-client-2025-11-20");
    const usage = { input: 0, output: 0, cacheRead: 0 };
    const textParts: string[] = [];
    let jsonRetries = 0;
    let finished = false;

    for (let step = 0; step < this.config.maxTurns && !finished; step++) {
      const stream = this.client.beta.messages.stream(
        {
          model: this.config.model,
          max_tokens: 64000,
          // Stable prefix (tools + system) is cached; the turn context lives in the user message.
          system: [{ type: "text", text: req.systemPrompt, cache_control: { type: "ephemeral" } }],
          tools,
          messages,
          thinking: { type: "adaptive", display: "summarized" },
          output_config: { effort: this.config.effort },
          // If the model declines, the API retries on a fallback model within the same call.
          ...(useFallbacks ? { fallbacks: "default" as const } : {}),
          ...(betas.length ? { betas } : {}),
          ...(mcpServers.length ? { mcp_servers: mcpServers } : {}),
        },
        { signal: req.signal },
      );

      let stepText = "";
      stream.on("text", (delta) => {
        stepText += delta;
        emit({ type: "text_delta", text: delta });
      });
      stream.on("thinking", (delta) => emit({ type: "thinking_delta", text: delta }));
      stream.on("contentBlock", (block) => {
        if (block.type === "mcp_tool_use") emit({ type: "tool_start", tool: `github.${block.name}`, input: {} });
      });

      let message: Anthropic.Beta.BetaMessage;
      try {
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (err) {
        // Only an unparseable streamed tool input is retried; API errors and aborts propagate.
        if (err instanceof Anthropic.APIError || req.signal.aborted || jsonRetries++ >= 2) throw err;
        continue;
      }

      usage.input += message.usage.input_tokens + (message.usage.cache_creation_input_tokens ?? 0);
      usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
      usage.output += message.usage.output_tokens;
      if (stepText.trim()) textParts.push(stepText.trim());

      const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");

      switch (message.stop_reason) {
        case "refusal":
          // A refusal can cut a tool call off mid-input; never run that step's tools.
          emit({ type: "error", message: "Claude declined this request. Try rephrasing it." });
          finished = true;
          continue;
        case "pause_turn":
          messages.push({ role: "assistant", content: message.content });
          continue;
        case "max_tokens":
          if (toolUses.length > 0) {
            throw new Error("A file was too large to generate in one step. Ask for smaller changes or split the file.");
          }
          finished = true;
          continue;
        case "tool_use":
          break;
        default: // end_turn, stop_sequence, …
          finished = true;
          continue;
      }

      if (toolUses.length === 0) {
        finished = true;
        continue;
      }

      messages.push({ role: "assistant", content: message.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of toolUses) {
        const result = await req.tools.execute(block.name, block.input);
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result.text,
          ...(result.ok ? {} : { is_error: true }),
        });
      }
      // All results go back in a single user message.
      messages.push({ role: "user", content: results });
    }

    if (!finished) {
      emit({ type: "error", message: `Stopped after ${this.config.maxTurns} steps. Ask Claude to continue.` });
    }
    emit({ type: "usage", inputTokens: usage.input, outputTokens: usage.output, cacheReadTokens: usage.cacheRead });
    emit({ type: "done", text: textParts.join("\n\n") });
  }

  describeError(err: unknown): string | undefined {
    if (err instanceof Anthropic.AuthenticationError) return "Anthropic API key is missing or invalid (ANTHROPIC_API_KEY).";
    if (err instanceof Anthropic.PermissionDeniedError) return "This API key isn't allowed to use the configured model.";
    if (err instanceof Anthropic.NotFoundError) return `Model "${this.config.model}" was not found (check AI_MODEL).`;
    if (err instanceof Anthropic.RateLimitError) return "Claude is busy right now (rate limited). Please retry in a moment.";
    if (err instanceof Anthropic.BadRequestError) return `Request rejected by the API: ${err.message}`;
    if (err instanceof Anthropic.InternalServerError) return "Claude had a temporary server error. Please retry.";
    if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the Anthropic API. Check your network.";
    if (err instanceof Anthropic.APIError) return `Anthropic API error ${err.status ?? ""}: ${err.message}`;
    return undefined;
  }
}
