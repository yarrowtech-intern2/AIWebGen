import type { SiteKit } from "@/kits/types";
import type { ProjectFileStore } from "@/server/projects/file-store";
import { Channel } from "./channel";
import { buildSystemPrompt, buildTurnContext } from "./prompt";
import { AnthropicApiProvider } from "./providers/anthropic-api";
import { ClaudeCodeProvider } from "./providers/claude-code";
import { createProjectTools } from "./tools";
import type { AgentEvent, AgentProvider, AiConfig, ChatTurn, ProviderId } from "./types";

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

export function loadAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const provider = (env.AI_PROVIDER ?? "claude-code") as ProviderId;
  if (provider !== "claude-code" && provider !== "anthropic-api") {
    throw new Error(`AI_PROVIDER must be "claude-code" or "anthropic-api" (got "${provider}")`);
  }
  const effort = (env.AI_EFFORT ?? "medium") as AiConfig["effort"];
  if (!EFFORTS.includes(effort)) throw new Error(`AI_EFFORT must be one of ${EFFORTS.join(", ")}`);
  return {
    provider,
    model: env.AI_MODEL || "claude-opus-5-5",
    effort,
    maxTurns: Number(env.AI_MAX_STEPS ?? 40),
  };
}

export function getProvider(config: AiConfig): AgentProvider {
  return config.provider === "anthropic-api" ? new AnthropicApiProvider(config) : new ClaudeCodeProvider(config);
}

export type RunTurnOptions = {
  store: ProjectFileStore;
  kit: SiteKit;
  history: ChatTurn[];
  userMessage: string;
  signal?: AbortSignal;
  config?: AiConfig;
};

/**
 * Runs one agent turn against a project and streams events. Provider errors
 * are converted into a final `error` event rather than thrown.
 */
export async function* runAgentTurn(opts: RunTurnOptions): AsyncGenerator<AgentEvent> {
  const config = opts.config ?? loadAiConfig();
  const signal = opts.signal ?? new AbortController().signal;
  const channel = new Channel<AgentEvent>();
  const emit = (event: AgentEvent) => channel.push(event);

  let provider: AgentProvider;
  try {
    provider = getProvider(config);
  } catch (err) {
    yield { type: "error", message: err instanceof Error ? err.message : String(err) };
    return;
  }

  const tools = createProjectTools(opts.store, opts.kit, emit);
  const request = {
    systemPrompt: buildSystemPrompt(opts.kit),
    turnContext: await buildTurnContext(opts.store, opts.kit),
    history: opts.history,
    userMessage: opts.userMessage,
    tools,
    kit: opts.kit,
    signal,
  };

  const running = provider
    .run(request, emit)
    .catch((err: unknown) => {
      const message = signal.aborted
        ? "Stopped by user."
        : (provider.describeError?.(err) ?? (err instanceof Error ? err.message : String(err)));
      emit({ type: "error", message });
    })
    .finally(() => channel.close());

  yield* channel;
  await running;
}

export type { AgentEvent, AiConfig, ChatTurn } from "./types";
