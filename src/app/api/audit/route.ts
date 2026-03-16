import { queryAuditLog, pruneAuditLog, type AuditEvent } from "@/lib/audit-log";
import { serverError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const event = url.searchParams.get("event") as AuditEvent | null;
    const since = url.searchParams.get("since") ? parseInt(url.searchParams.get("since")!, 10) : undefined;

    const result = await queryAuditLog({
      limit: isNaN(limit) ? 50 : limit,
      offset: isNaN(offset) ? 0 : offset,
      event: event || undefined,
      since,
    });

    return Response.json(result);
  } catch {
    return serverError("Failed to query audit log");
  }
}

export async function DELETE() {
  try {
    const pruned = await pruneAuditLog();
    return Response.json({ pruned });
  } catch {
    return serverError("Failed to prune audit log");
  }
}
