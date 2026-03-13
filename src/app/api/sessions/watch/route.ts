import { watch, type FSWatcher } from "fs";
import {
  resolveJsonlPath,
  readSessionMessages,
  getSessionModifiedAt,
  parseLiveEvents,
} from "@/lib/transcript-reader";
import { getWorkspace } from "@/lib/workspace";
import { SESSION_ID_RE } from "@/lib/validation";
import { isActive, onProcessExit, getLiveEvents, onLiveUpdate } from "@/lib/process-registry";

export const dynamic = "force-dynamic";

const DEBOUNCE_MS = 150;
const KEEPALIVE_MS = 15_000;
const FILE_POLL_MS = 800;

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
  let jsonlPath = await resolveJsonlPath(workspace, sessionId);

  if (!jsonlPath && !isActive(sessionId)) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }

  let watcher: FSWatcher | null = null;
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let filePollTimer: ReturnType<typeof setInterval> | null = null;
  let unsubExit: (() => void) | null = null;
  let unsubLive: (() => void) | null = null;
  let lastSentModified = 0;
  let cancelled = false;

  function startFileWatcher(
    path: string,
    controller: ReadableStreamDefaultController,
    pushUpdate: () => Promise<void>,
  ) {
    try {
      watcher = watch(path, () => {
        if (cancelled) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void pushUpdate(), DEBOUNCE_MS);
      });
      watcher.on("error", () => {
        cleanup();
        try { controller.close(); } catch { /* already closed */ }
      });
    } catch {
      // watcher setup failed — rely on process exit
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const pushFileUpdate = async () => {
        if (cancelled || !jsonlPath) return;
        try {
          const modifiedAt = await getSessionModifiedAt(workspace, sessionId);
          if (modifiedAt <= lastSentModified) return;

          const { messages, toolCalls } = await readSessionMessages(workspace, sessionId);
          lastSentModified = modifiedAt;
          controller.enqueue(sseMessage("update", { messages, toolCalls, modifiedAt, isActive: isActive(sessionId) }));
        } catch {
          // file read error — skip
        }
      };

      if (jsonlPath) {
        const { messages, toolCalls, modifiedAt: initialModified } = await readSessionMessages(workspace, sessionId);
        lastSentModified = initialModified;
        controller.enqueue(sseMessage("connected", { messages, toolCalls, modifiedAt: initialModified, isActive: isActive(sessionId) }));
        startFileWatcher(jsonlPath, controller, pushFileUpdate);
      } else {
        const events = getLiveEvents(sessionId);
        const { messages, toolCalls } = parseLiveEvents(events, sessionId);
        controller.enqueue(sseMessage("connected", { messages, toolCalls, modifiedAt: Date.now(), isActive: true }));

        unsubLive = onLiveUpdate(sessionId, () => {
          if (cancelled) return;
          const latest = getLiveEvents(sessionId);
          const parsed = parseLiveEvents(latest, sessionId);
          controller.enqueue(sseMessage("update", { messages: parsed.messages, toolCalls: parsed.toolCalls, modifiedAt: Date.now(), isActive: isActive(sessionId) }));
        });

        filePollTimer = setInterval(async () => {
          if (cancelled) return;
          const path = await resolveJsonlPath(workspace, sessionId);
          if (!path) return;
          jsonlPath = path;
          if (filePollTimer) { clearInterval(filePollTimer); filePollTimer = null; }
          if (unsubLive) { unsubLive(); unsubLive = null; }
          startFileWatcher(path, controller, pushFileUpdate);
          void pushFileUpdate();
        }, FILE_POLL_MS);
      }

      unsubExit = onProcessExit(sessionId, async () => {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 300));
        try {
          const { messages, toolCalls, modifiedAt } = await readSessionMessages(workspace, sessionId);
          if (modifiedAt > lastSentModified) lastSentModified = modifiedAt;
          controller.enqueue(sseMessage("update", { messages, toolCalls, modifiedAt, isActive: false }));
        } catch {
          const events = getLiveEvents(sessionId);
          const parsed = parseLiveEvents(events, sessionId);
          try {
            controller.enqueue(sseMessage("update", { messages: parsed.messages, toolCalls: parsed.toolCalls, modifiedAt: Date.now(), isActive: false }));
          } catch { /* stream closed */ }
        }
      });

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
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    if (filePollTimer) { clearInterval(filePollTimer); filePollTimer = null; }
    if (unsubExit) { unsubExit(); unsubExit = null; }
    if (unsubLive) { unsubLive(); unsubLive = null; }
    if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
    if (watcher) { watcher.close(); watcher = null; }
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
