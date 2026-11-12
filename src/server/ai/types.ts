import type { SiteKit } from "@/kits/types";
import type { ProjectTools } from "./tools";

/** Events streamed from one agent turn to the caller (CLI now, SSE to the browser in M2). */
export type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; text: string }
  | { type: "tool_start"; tool: string; input: Record<string, unknown> }
  | { type: "file_changed"; path: string; op: "write" | "edit" | "delete" }
  | { type: "tool_error"; tool: string; message: string }
  | { type: "usage"; inputTokens: number; outputTokens: number; cacheReadTokens?: number; costUsd?: number }
  | { type: "done"; text: string }
  | { type: "error"; message: string };

/** A previous chat turn, stored as plain text so either provider can replay it. */
export type ChatTurn = { role: "user" | "assistant"; text: string };

export type AgentRunRequest = {
  /** Stable instructions: base prompt + kit rules. Cached by the API provider. */
  systemPrompt: string;
  /** Volatile context for this turn, e.g. the current file index. */
  turnContext: string;
  history: ChatTurn[];
  userMessage: string;
  tools: ProjectTools;
  kit: SiteKit;
  signal: AbortSignal;
};

export type ProviderId = "claude-code" | "anthropic-api";

export interface AgentProvider {
  readonly id: ProviderId;
  /** Runs one agent turn. Tool-generated events are pushed through `emit`, which the provider also uses. */
  run(req: AgentRunRequest, emit: (event: AgentEvent) => void): Promise<void>;
  /** Turns a provider-specific error into a user-facing message, if recognised. */
  describeError?(err: unknown): string | undefined;
}

export type AiConfig = {
  provider: ProviderId;
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  maxTurns: number;
};
