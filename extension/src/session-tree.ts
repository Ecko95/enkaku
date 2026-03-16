import * as vscode from "vscode";
import type { EnkakuClient } from "./enkaku-client";
import type { StoredSession } from "./types";

export class SessionItem extends vscode.TreeItem {
  constructor(
    public readonly session: StoredSession,
    public readonly isRemote: boolean,
  ) {
    super(session.title || session.preview || session.id.slice(0, 8), vscode.TreeItemCollapsibleState.None);

    this.contextValue = "session";
    this.id = session.id;
    this.description = this.formatAge(session.updatedAt);
    this.tooltip = new vscode.MarkdownString(
      [
        `**${session.title || "Untitled"}**`,
        "",
        session.preview ? `> ${session.preview.slice(0, 200)}` : "",
        "",
        `ID: \`${session.id}\``,
        `Workspace: \`${session.workspace}\``,
        `Updated: ${new Date(session.updatedAt).toLocaleString()}`,
        isRemote ? "\n*Started remotely*" : "",
      ].join("\n"),
    );

    this.iconPath = isRemote
      ? new vscode.ThemeIcon("device-mobile", new vscode.ThemeColor("charts.yellow"))
      : new vscode.ThemeIcon("comment-discussion");

    if (session.pinned) {
      this.iconPath = new vscode.ThemeIcon("pinned", new vscode.ThemeColor("charts.blue"));
    }

    this.command = {
      command: "enkaku.openSession",
      title: "View Session",
      arguments: [this],
    };
  }

  private formatAge(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) { return "just now"; }
    if (mins < 60) { return `${mins}m ago`; }
    const hours = Math.floor(mins / 60);
    if (hours < 24) { return `${hours}h ago`; }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}

class CategoryItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly children: SessionItem[],
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "category";
    this.description = `${children.length}`;
  }
}

export class SessionTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private sessions: StoredSession[] = [];
  private localSessionIds = new Set<string>();

  constructor(private client: EnkakuClient) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  setLocalSessionIds(ids: Set<string>): void {
    this.localSessionIds = ids;
  }

  async fetchSessions(): Promise<void> {
    try {
      this.sessions = await this.client.getSessions();
    } catch {
      this.sessions = [];
    }
    this.refresh();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      return this.buildRootItems();
    }
    if (element instanceof CategoryItem) {
      return element.children;
    }
    return [];
  }

  private buildRootItems(): vscode.TreeItem[] {
    if (this.sessions.length === 0) {
      const empty = new vscode.TreeItem("No sessions found");
      empty.description = "Start Enkaku server first";
      empty.iconPath = new vscode.ThemeIcon("info");
      return [empty];
    }

    const showRemoteOnly = vscode.workspace
      .getConfiguration("enkaku")
      .get<boolean>("showRemoteOnly", false);

    const remote: SessionItem[] = [];
    const local: SessionItem[] = [];

    for (const s of this.sessions) {
      const isRemote = !this.localSessionIds.has(s.id);
      const item = new SessionItem(s, isRemote);
      if (isRemote) {
        remote.push(item);
      } else {
        local.push(item);
      }
    }

    if (showRemoteOnly) {
      if (remote.length === 0) {
        const empty = new vscode.TreeItem("No remote sessions");
        empty.iconPath = new vscode.ThemeIcon("device-mobile");
        return [empty];
      }
      return remote;
    }

    const items: vscode.TreeItem[] = [];
    if (remote.length > 0) {
      items.push(new CategoryItem("Remote Sessions", remote));
    }
    if (local.length > 0) {
      items.push(new CategoryItem("Local Sessions", local));
    }
    return items;
  }

  getSessionById(id: string): StoredSession | undefined {
    return this.sessions.find((s) => s.id === id);
  }
}
