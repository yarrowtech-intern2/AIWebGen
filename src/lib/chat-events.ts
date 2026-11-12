import type { AgentEvent } from "@/server/ai/types";

/** Server-sent events from POST /api/projects/:id/chat: the agent's events plus a final "saved". */
export type ChatStreamEvent = AgentEvent | { type: "saved"; messageId: string };

/** Parses a fetch() response body of Server-Sent Events into JSON events. */
export async function* readEventStream(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = chunk
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) yield JSON.parse(data) as ChatStreamEvent;
    }
  }
}
