import { getActiveSessionIds, killProcess } from "@/lib/process-registry";
import { SESSION_ID_RE } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ sessions: getActiveSessionIds() });
}

export async function DELETE(req: Request) {
  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.sessionId || !SESSION_ID_RE.test(body.sessionId)) {
    return Response.json({ error: "invalid sessionId" }, { status: 400 });
  }

  const killed = killProcess(body.sessionId);
  return Response.json({ killed });
}
