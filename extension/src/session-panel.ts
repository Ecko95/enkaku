import * as vscode from "vscode";
import type { EnkakuClient } from "./enkaku-client";
import type { SessionDetail, ChatMessage, ToolCallInfo } from "./types";

export class SessionPanel {
  private static panels = new Map<string, SessionPanel>();
  private panel: vscode.WebviewPanel;
  private disposed = false;

  static show(
    sessionId: string,
    sessionTitle: string,
    client: EnkakuClient,
    workspace: string | undefined,
    extensionUri: vscode.Uri,
  ): SessionPanel {
    const existing = SessionPanel.panels.get(sessionId);
    if (existing && !existing.disposed) {
      existing.panel.reveal();
      existing.loadData(client, sessionId, workspace);
      return existing;
    }
    const instance = new SessionPanel(sessionId, sessionTitle, client, workspace, extensionUri);
    SessionPanel.panels.set(sessionId, instance);
    return instance;
  }

  private constructor(
    private sessionId: string,
    sessionTitle: string,
    client: EnkakuClient,
    workspace: string | undefined,
    extensionUri: vscode.Uri,
  ) {
    this.panel = vscode.window.createWebviewPanel(
      "enkaku.sessionDetail",
      `Enkaku: ${sessionTitle || sessionId.slice(0, 8)}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    this.panel.iconPath = new vscode.ThemeIcon("comment-discussion");

    this.panel.onDidDispose(() => {
      this.disposed = true;
      SessionPanel.panels.delete(sessionId);
    });

    this.panel.webview.onDidReceiveMessage((msg: { command: string; path?: string }) => {
      if (msg.command === "openFile" && msg.path) {
        const uri = vscode.Uri.file(msg.path);
        vscode.window.showTextDocument(uri, { preview: true });
      }
    });

    this.loadData(client, sessionId, workspace);
  }

  private async loadData(client: EnkakuClient, sessionId: string, workspace: string | undefined): Promise<void> {
    this.panel.webview.html = this.buildLoadingHtml();
    try {
      const detail = await client.getSessionHistory(sessionId, workspace);
      this.panel.webview.html = this.buildHtml(detail);
    } catch (err) {
      this.panel.webview.html = this.buildErrorHtml(
        err instanceof Error ? err.message : "Failed to load session",
      );
    }
  }

  private buildLoadingHtml(): string {
    return `<!DOCTYPE html>
<html><head>${this.styles()}</head>
<body><div class="loading">Loading session...</div></body></html>`;
  }

  private buildErrorHtml(message: string): string {
    return `<!DOCTYPE html>
<html><head>${this.styles()}</head>
<body><div class="error">Error: ${this.esc(message)}</div></body></html>`;
  }

  private buildHtml(detail: SessionDetail): string {
    const changedFiles = this.extractChangedFiles(detail.toolCalls);
    const filesSummary = changedFiles.length > 0
      ? `<div class="section">
          <h2>Changed Files (${changedFiles.length})</h2>
          <div class="file-list">
            ${changedFiles.map((f) => `
              <div class="file-row" data-path="${this.esc(f.path)}">
                <span class="file-icon">&#x1F4C4;</span>
                <span class="file-path">${this.esc(f.path)}</span>
                <span class="file-badge">${f.count} change${f.count > 1 ? "s" : ""}</span>
              </div>
            `).join("")}
          </div>
        </div>`
      : "";

    const toolSummary = this.buildToolSummary(detail.toolCalls);

    const messages = detail.messages
      .map((m) => this.renderMessage(m))
      .join("");

    return `<!DOCTYPE html>
<html><head>${this.styles()}</head>
<body>
  <div class="header">
    <div class="session-id">${this.esc(this.sessionId.slice(0, 8))}...</div>
    <div class="updated">Last updated: ${new Date(detail.modifiedAt).toLocaleString()}</div>
  </div>

  ${toolSummary}
  ${filesSummary}

  <div class="section">
    <h2>Conversation</h2>
    <div class="messages">${messages}</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('.file-row').forEach(el => {
      el.addEventListener('click', () => {
        vscode.postMessage({ command: 'openFile', path: el.dataset.path });
      });
    });
  </script>
</body></html>`;
  }

  private renderMessage(msg: ChatMessage): string {
    const role = msg.role === "user" ? "You" : "Assistant";
    const cls = msg.role === "user" ? "msg-user" : "msg-assistant";
    const content = this.esc(msg.content).replace(/\n/g, "<br>");
    return `<div class="message ${cls}">
      <div class="msg-role">${role}</div>
      <div class="msg-content">${content}</div>
    </div>`;
  }

  private buildToolSummary(toolCalls: ToolCallInfo[]): string {
    if (toolCalls.length === 0) { return ""; }

    const counts: Record<string, number> = {};
    for (const tc of toolCalls) {
      counts[tc.type] = (counts[tc.type] ?? 0) + 1;
    }

    const badges = Object.entries(counts)
      .map(([type, count]) => `<span class="tool-badge tool-${type}">${type}: ${count}</span>`)
      .join(" ");

    return `<div class="section">
      <h2>Tool Activity</h2>
      <div class="tool-summary">${badges}</div>
    </div>`;
  }

  private extractChangedFiles(toolCalls: ToolCallInfo[]): Array<{ path: string; count: number }> {
    const map = new Map<string, number>();
    for (const tc of toolCalls) {
      if (!tc.path) { continue; }
      if (tc.type !== "write" && tc.type !== "edit") { continue; }
      map.set(tc.path, (map.get(tc.path) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count);
  }

  private esc(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  private styles(): string {
    return `<style>
      :root {
        --bg: var(--vscode-editor-background, #1e1e1e);
        --fg: var(--vscode-editor-foreground, #d4d4d4);
        --border: var(--vscode-panel-border, #333);
        --accent: var(--vscode-textLink-foreground, #4fc1ff);
        --badge-bg: var(--vscode-badge-background, #4d4d4d);
        --badge-fg: var(--vscode-badge-foreground, #fff);
        --user-bg: var(--vscode-textBlockQuote-background, #2a2a2a);
        --assistant-bg: var(--vscode-editor-background, #1e1e1e);
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: var(--vscode-font-family, system-ui);
        font-size: var(--vscode-font-size, 13px);
        color: var(--fg);
        background: var(--bg);
        padding: 16px;
        line-height: 1.5;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border);
        margin-bottom: 16px;
      }
      .session-id { font-family: monospace; opacity: 0.7; }
      .updated { font-size: 0.85em; opacity: 0.6; }
      .section { margin-bottom: 20px; }
      h2 {
        font-size: 1.1em;
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--accent);
      }
      .loading, .error {
        text-align: center;
        padding: 40px;
        opacity: 0.7;
      }
      .error { color: var(--vscode-errorForeground, #f44); }
      .file-list { display: flex; flex-direction: column; gap: 4px; }
      .file-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .file-row:hover { background: var(--badge-bg); }
      .file-icon { font-size: 1em; }
      .file-path {
        flex: 1;
        font-family: monospace;
        font-size: 0.9em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .file-badge {
        font-size: 0.8em;
        background: var(--badge-bg);
        color: var(--badge-fg);
        padding: 1px 6px;
        border-radius: 8px;
      }
      .tool-summary { display: flex; flex-wrap: wrap; gap: 6px; }
      .tool-badge {
        font-size: 0.8em;
        padding: 2px 8px;
        border-radius: 10px;
        background: var(--badge-bg);
        color: var(--badge-fg);
      }
      .tool-edit { background: #5c4a1e; color: #ffd866; }
      .tool-write { background: #1e4a2e; color: #66ffa3; }
      .tool-shell { background: #1e2e4a; color: #66b3ff; }
      .tool-read { background: #3a3a3a; }
      .tool-search { background: #3a2e4a; color: #c899ff; }
      .messages { display: flex; flex-direction: column; gap: 12px; }
      .message {
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid var(--border);
      }
      .msg-user { background: var(--user-bg); }
      .msg-assistant { background: var(--assistant-bg); }
      .msg-role {
        font-weight: 600;
        font-size: 0.85em;
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.7;
      }
      .msg-content {
        white-space: pre-wrap;
        word-break: break-word;
      }
    </style>`;
  }
}
