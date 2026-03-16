import type { ChatMessage, ToolCallInfo } from "@/lib/types";

function toolCallLine(tc: ToolCallInfo): string {
  const label = tc.type === "shell" ? "Shell" : tc.type === "search" ? "Search" : tc.type === "edit" ? "Edit" : tc.type === "write" ? "Write" : tc.type === "read" ? "Read" : tc.name;
  const target = tc.type === "shell" ? tc.command : tc.path;
  return target ? `> **${label}** \`${target}\`` : `> **${label}**`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function exportSessionMarkdown(messages: ChatMessage[], toolCalls: ToolCallInfo[]): string {
  const items = [
    ...messages.map((m) => ({ ts: m.timestamp, kind: "msg" as const, msg: m })),
    ...toolCalls.map((tc) => ({ ts: tc.timestamp, kind: "tc" as const, tc })),
  ].sort((a, b) => a.ts - b.ts);

  const parts: string[] = [];

  for (const item of items) {
    if (item.kind === "msg" && item.msg) {
      const role = item.msg.role === "user" ? "User" : "Assistant";
      parts.push(`## ${role}\n\n${item.msg.content}`);
    } else if (item.kind === "tc" && item.tc) {
      parts.push(toolCallLine(item.tc));
    }
  }

  return parts.join("\n\n");
}

export function exportSessionJson(
  messages: ChatMessage[],
  toolCalls: ToolCallInfo[],
  meta?: { sessionId?: string; workspace?: string },
): string {
  return JSON.stringify({
    meta: {
      exportedAt: new Date().toISOString(),
      sessionId: meta?.sessionId,
      workspace: meta?.workspace,
      messageCount: messages.length,
      toolCallCount: toolCalls.length,
    },
    messages,
    toolCalls,
  }, null, 2);
}

export function exportSessionHtml(
  messages: ChatMessage[],
  toolCalls: ToolCallInfo[],
  meta?: { sessionId?: string; workspace?: string },
): string {
  const items = [
    ...messages.map((m) => ({ ts: m.timestamp, kind: "msg" as const, msg: m })),
    ...toolCalls.map((tc) => ({ ts: tc.timestamp, kind: "tc" as const, tc })),
  ].sort((a, b) => a.ts - b.ts);

  const bodyParts: string[] = [];
  for (const item of items) {
    if (item.kind === "msg" && item.msg) {
      const role = item.msg.role;
      const cls = role === "user" ? "user-msg" : "assistant-msg";
      const label = role === "user" ? "You" : "Assistant";
      const time = new Date(item.msg.timestamp).toLocaleTimeString();
      bodyParts.push(
        `<div class="msg ${cls}"><div class="msg-header"><strong>${label}</strong><span class="time">${time}</span></div><div class="msg-body"><pre>${escapeHtml(item.msg.content)}</pre></div></div>`,
      );
    } else if (item.kind === "tc" && item.tc) {
      const tc = item.tc;
      const label = tc.type === "shell" ? "Shell" : tc.type === "search" ? "Search" : tc.type === "edit" ? "Edit" : tc.type === "write" ? "Write" : tc.type === "read" ? "Read" : tc.name;
      const target = tc.type === "shell" ? tc.command : tc.path;
      bodyParts.push(
        `<div class="tool-call"><span class="tool-label">${escapeHtml(label)}</span>${target ? ` <code>${escapeHtml(target)}</code>` : ""}</div>`,
      );
    }
  }

  const title = meta?.sessionId ? `Session ${meta.sessionId.slice(0, 8)}` : "Enkaku Session Export";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0b;color:#e8e8e8;font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px;max-width:800px;margin:0 auto}
h1{font-size:18px;font-weight:600;margin-bottom:4px}
.meta{font-size:12px;color:#888;margin-bottom:24px}
.msg{margin-bottom:16px;padding:12px;border-radius:8px;border:1px solid #1e1e1e}
.user-msg{background:#111;border-left:3px solid #555}
.assistant-msg{background:#0d1117;border-left:3px solid #238636}
.msg-header{display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px}
.time{color:#666}
.msg-body pre{white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.6;font-family:"SF Mono","Fira Code",monospace}
.tool-call{font-size:12px;color:#888;padding:4px 12px;margin-bottom:4px}
.tool-label{background:#1e1e1e;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600}
code{background:#1e1e1e;padding:2px 4px;border-radius:3px;font-size:11px}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${meta?.workspace ? escapeHtml(meta.workspace) + " &middot; " : ""}Exported ${new Date().toLocaleString()}</p>
${bodyParts.join("\n")}
</body>
</html>`;
}
