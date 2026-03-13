import { spawnAgent, createStreamFromProcess } from "@/lib/cursor-cli";
import { getWorkspace } from "@/lib/workspace";
import { upsertSession } from "@/lib/session-store";
import { registerProcess, promoteToSessionId } from "@/lib/process-registry";
import { SESSION_ID_RE } from "@/lib/validation";
import type { ChatRequest, AgentMode } from "@/lib/types";

const VALID_MODES: AgentMode[] = ["agent", "ask", "plan"];

export const dynamic = "force-dynamic";

function createTappedStream(
  source: ReadableStream<Uint8Array>,
  workspace: string,
  prompt: string,
  requestId: string,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let captured = false;
  let closed = false;

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (closed) return;
        if (done) {
          closed = true;
          controller.close();
          return;
        }

        if (!captured && value) {
          const text = new TextDecoder().decode(value);
          for (const line of text.split("\n")) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              if (event.type === "system" && event.subtype === "init" && event.session_id) {
                upsertSession(event.session_id, workspace, prompt);
                promoteToSessionId(requestId, event.session_id);
                captured = true;
              }
            } catch {
              // non-json line, skip
            }
          }
        }

        controller.enqueue(value);
      } catch {
        if (!closed) {
          closed = true;
        }
      }
    },
    cancel() {
      closed = true;
      // do NOT cancel the underlying reader or kill the process --
      // the agent keeps running in the background
    },
  });
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  if (body.sessionId !== undefined && !SESSION_ID_RE.test(body.sessionId)) {
    return Response.json({ error: "invalid sessionId" }, { status: 400 });
  }

  if (body.mode !== undefined && !VALID_MODES.includes(body.mode)) {
    return Response.json({ error: "invalid mode" }, { status: 400 });
  }

  if (
    body.model !== undefined &&
    (typeof body.model !== "string" ||
      body.model.length > 128 ||
      /[^a-zA-Z0-9._/-]/.test(body.model))
  ) {
    return Response.json({ error: "invalid model" }, { status: 400 });
  }

  const workspace = getWorkspace();

  try {
    const requestId = crypto.randomUUID();

    const child = spawnAgent({
      prompt: body.prompt,
      sessionId: body.sessionId,
      workspace,
      model: body.model,
      mode: body.mode,
    });

    registerProcess(requestId, child, workspace);

    if (body.sessionId) {
      promoteToSessionId(requestId, body.sessionId);
    }

    const rawStream = createStreamFromProcess(child);
    const stream = createTappedStream(rawStream, workspace, body.prompt, requestId);

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start agent";
    return Response.json({ error: message }, { status: 500 });
  }
}
