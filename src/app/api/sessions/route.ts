import { listSessions, deleteSession, archiveSession, unarchiveSession, archiveAllSessions } from "@/lib/session-store";
import { readCursorSessions } from "@/lib/transcript-reader";
import { getWorkspace } from "@/lib/workspace";
import { deleteSessionSchema, parseBody } from "@/lib/validation";
import { badRequest, parseJsonBody, serverError } from "@/lib/errors";
import type { StoredSession } from "@/lib/types";

export const dynamic = "force-dynamic";

function mergeSessions(ours: StoredSession[], cursor: StoredSession[]): StoredSession[] {
  const byId = new Map<string, StoredSession>();

  for (const s of cursor) {
    byId.set(s.id, s);
  }
  for (const s of ours) {
    const existing = byId.get(s.id);
    if (existing) {
      byId.set(s.id, {
        ...existing,
        updatedAt: Math.max(existing.updatedAt, s.updatedAt),
      });
    } else {
      byId.set(s.id, s);
    }
  }

  return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const all = url.searchParams.get("all") === "true";
  const workspaceParam = url.searchParams.get("workspace");
  const archived = url.searchParams.get("archived") === "true";
  const workspace = workspaceParam || getWorkspace();

  if (all) {
    const ours = await listSessions(undefined, archived);
    return Response.json({ sessions: ours, workspace });
  }

  const cursorSessions = await readCursorSessions(workspace);
  const ourSessions = await listSessions(workspace, archived);
  const merged = mergeSessions(ourSessions, cursorSessions);

  return Response.json({ sessions: merged, workspace });
}

export async function DELETE(req: Request) {
  const raw = await parseJsonBody<{ sessionId?: string }>(req);
  if (raw instanceof Response) return raw;

  const parsed = parseBody(deleteSessionSchema, raw);
  if ("error" in parsed) return badRequest(parsed.error);

  await deleteSession(parsed.data.sessionId);
  return Response.json({ ok: true });
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json() as { action: string; sessionId?: string; workspace?: string };
    const { action, sessionId, workspace } = body;

    switch (action) {
      case "archive":
        if (!sessionId) return badRequest("sessionId required");
        await archiveSession(sessionId);
        break;
      case "unarchive":
        if (!sessionId) return badRequest("sessionId required");
        await unarchiveSession(sessionId);
        break;
      case "archive_all":
        await archiveAllSessions(workspace);
        break;
      default:
        return badRequest("Invalid action");
    }

    return Response.json({ ok: true });
  } catch {
    return serverError("Failed to update session");
  }
}
