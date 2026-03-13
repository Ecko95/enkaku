import { spawnAgent } from "@/lib/cursor-cli";
import { getWorkspace } from "@/lib/workspace";
import { upsertSession } from "@/lib/session-store";
import { registerProcess, promoteToSessionId, pushLiveEvent } from "@/lib/process-registry";
import { SESSION_ID_RE } from "@/lib/validation";
import type { ChatRequest, AgentMode } from "@/lib/types";

const VALID_MODES: AgentMode[] = ["agent", "ask", "plan"];
const INIT_TIMEOUT_MS = 30_000;

export const dynamic = "force-dynamic";

function waitForSessionId(
  child: ReturnType<typeof spawnAgent>,
  workspace: string,
  prompt: string,
  requestId: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    let found = false;
    let buffer = "";
    let resolvedSessionId: string | null = null;

    const timer = setTimeout(() => {
      if (!found) resolve(null);
    }, INIT_TIMEOUT_MS);

    child.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);

          if (!found && event.type === "system" && event.subtype === "init" && event.session_id) {
            found = true;
            resolvedSessionId = event.session_id;
            clearTimeout(timer);
            void upsertSession(event.session_id, workspace, prompt);
            promoteToSessionId(requestId, event.session_id);
            resolve(event.session_id);
          }

          if (resolvedSessionId && (event.type === "user" || event.type === "assistant")) {
            pushLiveEvent(resolvedSessionId, event);
          }
        } catch {
          // non-json line
        }
      }
    });

    child.on("close", () => {
      if (!found) {
        clearTimeout(timer);
        resolve(null);
      }
    });

    child.on("error", () => {
      if (!found) {
        clearTimeout(timer);
        resolve(null);
      }
    });
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
    const { randomUUID } = await import("node:crypto");
    const requestId = randomUUID();

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

    child.stderr?.on("data", () => {});

    const sessionId = await waitForSessionId(child, workspace, body.prompt, requestId);

    if (!sessionId) {
      child.kill("SIGTERM");
      return Response.json({ error: "Agent failed to start" }, { status: 500 });
    }

    return Response.json({ sessionId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start agent";
    return Response.json({ error: message }, { status: 500 });
  }
}
