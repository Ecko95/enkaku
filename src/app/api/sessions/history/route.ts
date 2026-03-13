import { readSessionMessages, getSessionModifiedAt } from "@/lib/transcript-reader";
import { getWorkspace } from "@/lib/workspace";
import { SESSION_ID_RE } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("id");
  const checkOnly = url.searchParams.get("check") === "true";
  const sinceParam = url.searchParams.get("since");

  if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
    return Response.json({ error: "invalid or missing session id" }, { status: 400 });
  }

  const workspace = getWorkspace();

  if (checkOnly) {
    const modifiedAt = await getSessionModifiedAt(workspace, sessionId);
    return Response.json({ sessionId, modifiedAt });
  }

  if (sinceParam) {
    const since = parseInt(sinceParam, 10);
    const modifiedAt = await getSessionModifiedAt(workspace, sessionId);
    if (!isNaN(since) && modifiedAt <= since) {
      return Response.json({ sessionId, modifiedAt, messages: null, toolCalls: null });
    }
  }

  const { messages, toolCalls, modifiedAt } = await readSessionMessages(workspace, sessionId);
  return Response.json({ messages, toolCalls, sessionId, modifiedAt });
}
