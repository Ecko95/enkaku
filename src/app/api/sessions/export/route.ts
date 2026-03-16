import { readSessionMessages } from "@/lib/transcript-reader";
import { getWorkspace } from "@/lib/workspace";
import { exportSessionMarkdown, exportSessionJson, exportSessionHtml } from "@/lib/export";
import { badRequest, serverError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("id");
  const format = url.searchParams.get("format") || "md";
  const workspace = url.searchParams.get("workspace") || getWorkspace();

  if (!sessionId) return badRequest("id parameter is required");
  if (!["md", "json", "html"].includes(format)) return badRequest("format must be md, json, or html");

  try {
    const { messages, toolCalls } = await readSessionMessages(workspace, sessionId);
    const meta = { sessionId, workspace };

    switch (format) {
      case "json": {
        const content = exportSessionJson(messages, toolCalls, meta);
        return new Response(content, {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="session-${sessionId.slice(0, 8)}.json"`,
          },
        });
      }
      case "html": {
        const content = exportSessionHtml(messages, toolCalls, meta);
        return new Response(content, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `attachment; filename="session-${sessionId.slice(0, 8)}.html"`,
          },
        });
      }
      default: {
        const content = exportSessionMarkdown(messages, toolCalls);
        return new Response(content, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="session-${sessionId.slice(0, 8)}.md"`,
          },
        });
      }
    }
  } catch {
    return serverError("Failed to export session");
  }
}
