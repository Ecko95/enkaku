import { writeToTerminal } from "@/lib/terminal-registry";
import { badRequest, parseJsonBody } from "@/lib/errors";
import { logAudit } from "@/lib/audit-log";
import { getTerminalPolicy, checkCommand } from "@/lib/terminal-policy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await parseJsonBody<{ id?: string; data?: string }>(req);
  if (body instanceof Response) return body;

  if (!body.id) return badRequest("id is required");
  if (body.data === undefined) return badRequest("data is required");

  if (body.data.includes("\n") || body.data.includes("\r")) {
    const policy = await getTerminalPolicy();
    const check = checkCommand(body.data, policy);
    if (!check.allowed) {
      void logAudit("terminal_command", `BLOCKED terminal=${body.id} input=${body.data.trim().slice(0, 100)} reason=${check.reason}`);
      return badRequest(check.reason || "Command blocked by terminal policy");
    }
    void logAudit("terminal_command", `terminal=${body.id} input=${body.data.trim().slice(0, 100)}`);
  }

  const ok = writeToTerminal(body.id, body.data);
  if (!ok) return badRequest("terminal not found or not running");

  return Response.json({ ok: true });
}
