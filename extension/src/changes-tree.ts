import * as vscode from "vscode";
import type { ChangedFile, ToolCallInfo } from "./types";

export class ChangedFileItem extends vscode.TreeItem {
  constructor(public readonly file: ChangedFile) {
    super(file.path.split("/").pop() || file.path, vscode.TreeItemCollapsibleState.None);

    this.contextValue = "changedFile";
    this.description = file.path;
    this.resourceUri = vscode.Uri.file(file.path);

    const editCount = file.edits + file.writes;
    this.tooltip = new vscode.MarkdownString(
      [
        `**${file.path}**`,
        "",
        `${file.edits} edit(s), ${file.writes} write(s)`,
        `Session: ${file.sessionTitle}`,
      ].join("\n"),
    );

    this.iconPath = editCount > 3
      ? new vscode.ThemeIcon("diff-modified", new vscode.ThemeColor("charts.orange"))
      : new vscode.ThemeIcon("diff-modified");

    this.command = {
      command: "enkaku.openChangedFile",
      title: "Open File",
      arguments: [this],
    };
  }
}

export class ChangesTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private files: ChangedFile[] = [];

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  setChangedFiles(toolCalls: ToolCallInfo[], sessionId: string, sessionTitle: string): void {
    const fileMap = new Map<string, ChangedFile>();

    for (const tc of toolCalls) {
      if (!tc.path) { continue; }
      if (tc.type !== "write" && tc.type !== "edit") { continue; }

      const existing = fileMap.get(tc.path) ?? {
        path: tc.path,
        sessionId,
        sessionTitle,
        edits: 0,
        writes: 0,
        diffs: [],
      };

      if (tc.type === "edit") { existing.edits++; }
      if (tc.type === "write") { existing.writes++; }
      if (tc.diff) { existing.diffs.push(tc.diff); }

      fileMap.set(tc.path, existing);
    }

    this.files = Array.from(fileMap.values()).sort((a, b) =>
      (b.edits + b.writes) - (a.edits + a.writes),
    );
    this.refresh();
  }

  clear(): void {
    this.files = [];
    this.refresh();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<vscode.TreeItem[]> {
    if (this.files.length === 0) {
      const empty = new vscode.TreeItem("Select a session to see changes");
      empty.iconPath = new vscode.ThemeIcon("info");
      return [empty];
    }
    return this.files.map((f) => new ChangedFileItem(f));
  }
}
