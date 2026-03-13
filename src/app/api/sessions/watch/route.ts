import { watch, type FSWatcher } from "fs";
import {
  resolveJsonlPath,
  readSessionMessages,
  getSessionModifiedAt,
} from "@/lib/transcript-reader";
import { getWorkspace } from "@/lib/workspace";
import { SESSION_ID_RE } from "@/lib/validation";
import { isActive } from "@/lib/process-registry";

export const dynamic = "force-dynamic";

const DEBOUNCE_MS = 150;
const KEEPALIVE_MS = 15_000;

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("id");

  if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
    return Response.json({ error: "invalid or missing session id" }, { status: 400 });
  }

  const workspace = getWorkspace();
  const jsonlPath = resolveJsonlPath(workspace, sessionId);

  if (!jsonlPath) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }

  let watcher: FSWatcher | null = null;
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSentModified = 0;
  let cancelled = false;

  const stream = new ReadableStream({
    start(controller) {
      const initialModified = getSessionModifiedAt(workspace, sessionId);
      lastSentModified = initialModified;
      controller.enqueue(sseMessage("connected", { modifiedAt: initialModified, isActive: isActive(sessionId) }));

      const pushUpdate = () => {
        if (cancelled) return;
        try {
          const modifiedAt = getSessionModifiedAt(workspace, sessionId);
          if (modifiedAt <= lastSentModified) return;

          const { messages, toolCalls } = readSessionMessages(workspace, sessionId);
          lastSentModified = modifiedAt;
          controller.enqueue(sseMessage("update", { messages, toolCalls, modifiedAt, isActive: isActive(sessionId) }));
        } catch {
          // file read error -- skip this update
        }
      };

      try {
        watcher = watch(jsonlPath, () => {
          if (cancelled) return;
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(pushUpdate, DEBOUNCE_MS);
        });

        watcher.on("error", () => {
          // watcher error -- client will reconnect
          cleanup();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
      } catch {
        controller.enqueue(sseMessage("error", { message: "failed to watch file" }));
        controller.close();
        return;
      }

      keepaliveTimer = setInterval(() => {
        if (cancelled) return;
        try {
          controller.enqueue(sseMessage("ping", { ts: Date.now() }));
        } catch {
          cleanup();
        }
      }, KEEPALIVE_MS);
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    cancelled = true;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
    if (watcher) {
      watcher.close();
      watcher = null;
    }
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
