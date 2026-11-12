import { z } from "zod";
import { getKit } from "@/kits";
import type { ChatStreamEvent } from "@/lib/chat-events";
import { runAgentTurn } from "@/server/ai";
import { endTurn, startTurn } from "@/server/ai/active-turns";
import { errorResponse, HttpError, readJson, requireProject } from "@/server/http";
import { DbFileStore } from "@/server/projects/db-file-store";
import { addMessage, createVersion, getChatHistory, touchProject } from "@/server/projects/service";

const ChatRequest = z.object({ message: z.string().trim().min(1).max(10_000) });


/**
 * Runs one agent turn and streams its events as Server-Sent Events.
 * The user message and the assistant reply are persisted.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/projects/[id]/chat">) {
  let controller: AbortController | null = null;
  let projectId = "";
  try {
    const { id } = await ctx.params;
    projectId = id;
    const { project } = await requireProject(id);
    const { message } = await readJson(req, ChatRequest);
    const kit = getKit(project.kit);

    controller = startTurn(id);
    if (!controller) throw new HttpError(409, "Claude is already working on this project. Wait or press Stop.");
    const abort = controller;

    const history = await getChatHistory(id);
    await addMessage(id, "user", message);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(sink) {
        let open = true;
        const send = (event: ChatStreamEvent) => {
          if (!open) return;
          try {
            sink.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            open = false; // client went away; keep running so the turn is saved
          }
        };

        let streamedText = "";
        let finalText: string | null = null;
        let error: string | undefined;
        const changed = new Set<string>();

        try {
          for await (const event of runAgentTurn({
            store: new DbFileStore(id),
            kit,
            history,
            userMessage: message,
            signal: abort.signal,
          })) {
            if (event.type === "text_delta") streamedText += event.text;
            else if (event.type === "file_changed") changed.add(event.path);
            else if (event.type === "done") finalText = event.text;
            else if (event.type === "error") error = event.message;
            send(event);
          }
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          send({ type: "error", message: error });
        } finally {
          try {
            const content = (finalText || streamedText).trim();
            // One version per turn that changed files (including stopped or failed turns).
            let version: { id: string; number: number } | undefined;
            if (changed.size > 0) {
              await touchProject(id);
              const summary = message.length > 80 ? `${message.slice(0, 77)}…` : message;
              version = await createVersion(id, "ai", error ? `${summary} (incomplete)` : summary);
            }
            const saved = await addMessage(
              id,
              "assistant",
              content,
              {
                changedFiles: [...changed],
                ...(error ? { error } : {}),
                ...(version ? { versionNumber: version.number } : {}),
              },
              version?.id,
            );
            send({ type: "saved", messageId: saved.id, versionNumber: version?.number });
          } finally {
            endTurn(id, abort);
            if (open) sink.close();
          }
        }
      },
      cancel() {
        // Closing the tab doesn't stop the turn; use the Stop button for that.
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    if (controller) endTurn(projectId, controller);
    return errorResponse(err);
  }
}
