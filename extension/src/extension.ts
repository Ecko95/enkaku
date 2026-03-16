import * as vscode from "vscode";
import { EnkakuClient } from "./enkaku-client";
import { SessionTreeProvider, SessionItem } from "./session-tree";
import { ChangesTreeProvider, ChangedFileItem } from "./changes-tree";
import { SessionPanel } from "./session-panel";
import { getLocalSessionIds } from "./local-sessions";

let pollTimer: ReturnType<typeof setInterval> | undefined;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration("enkaku");
  const serverUrl = config.get<string>("serverUrl", "");
  const authToken = config.get<string>("authToken", "");

  const client = new EnkakuClient(
    serverUrl || "http://localhost:3100",
    authToken,
  );

  const sessionTree = new SessionTreeProvider(client);
  const changesTree = new ChangesTreeProvider();

  const sessionsView = vscode.window.createTreeView("enkaku.sessions", {
    treeDataProvider: sessionTree,
    showCollapseAll: true,
  });

  vscode.window.createTreeView("enkaku.changes", {
    treeDataProvider: changesTree,
  });

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBarItem.command = "enkaku.refresh";
  statusBarItem.text = "$(sync) Enkaku";
  statusBarItem.tooltip = "Click to refresh Enkaku sessions";
  context.subscriptions.push(statusBarItem);

  async function refreshAll(): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const localIds = getLocalSessionIds(ws);
    sessionTree.setLocalSessionIds(localIds);

    statusBarItem.text = "$(sync~spin) Enkaku";
    try {
      await sessionTree.fetchSessions();
      statusBarItem.text = "$(sync) Enkaku";
      statusBarItem.show();
    } catch {
      statusBarItem.text = "$(warning) Enkaku";
      statusBarItem.tooltip = "Cannot reach Enkaku server";
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("enkaku.refresh", () => refreshAll()),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("enkaku.openSession", async (item?: SessionItem) => {
      if (!item) {
        vscode.window.showInformationMessage("Select a session from the Enkaku sidebar.");
        return;
      }

      const detail = await client.getSessionHistory(item.session.id, item.session.workspace);
      changesTree.setChangedFiles(detail.toolCalls, item.session.id, item.session.title);

      SessionPanel.show(
        item.session.id,
        item.session.title,
        client,
        item.session.workspace,
        context.extensionUri,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("enkaku.openChangedFile", (item?: ChangedFileItem) => {
      if (!item) { return; }
      const uri = vscode.Uri.file(item.file.path);
      vscode.window.showTextDocument(uri, { preview: true });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("enkaku.continueSession", async (item?: SessionItem) => {
      if (!item) { return; }

      const terminal = vscode.window.createTerminal({
        name: `Enkaku: ${item.session.title?.slice(0, 30) || item.session.id.slice(0, 8)}`,
      });
      terminal.show();
      terminal.sendText(
        `cursor agent --session ${item.session.id} --workspace "${item.session.workspace}"`,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("enkaku.openInBrowser", (item?: SessionItem) => {
      if (!item) { return; }
      const url = config.get<string>("serverUrl", "http://localhost:3100");
      const token = config.get<string>("authToken", "");
      const sessionUrl = `${url}?token=${token}#session=${item.session.id}`;
      vscode.env.openExternal(vscode.Uri.parse(sessionUrl));
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("enkaku.configure", async () => {
      const url = await vscode.window.showInputBox({
        title: "Enkaku Server URL",
        prompt: "Enter the Enkaku server URL (e.g. http://192.168.1.50:3100)",
        value: config.get<string>("serverUrl", ""),
        placeHolder: "http://localhost:3100",
      });

      if (url !== undefined) {
        await config.update("serverUrl", url, vscode.ConfigurationTarget.Global);
      }

      const token = await vscode.window.showInputBox({
        title: "Auth Token",
        prompt: "Enter the Enkaku auth token",
        value: config.get<string>("authToken", ""),
        password: true,
      });

      if (token !== undefined) {
        await config.update("authToken", token, vscode.ConfigurationTarget.Global);
      }

      client.updateConfig(
        url ?? config.get<string>("serverUrl", "http://localhost:3100"),
        token ?? config.get<string>("authToken", ""),
      );

      refreshAll();
    }),
  );

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("enkaku")) {
      const updated = vscode.workspace.getConfiguration("enkaku");
      client.updateConfig(
        updated.get<string>("serverUrl", "http://localhost:3100"),
        updated.get<string>("authToken", ""),
      );
      startPolling();
      refreshAll();
    }
  });

  context.subscriptions.push(sessionsView);

  function startPolling(): void {
    if (pollTimer) { clearInterval(pollTimer); }
    const interval = vscode.workspace
      .getConfiguration("enkaku")
      .get<number>("pollIntervalSeconds", 10);
    pollTimer = setInterval(() => refreshAll(), interval * 1000);
  }

  // Initial load
  void initializeConnection(client).then(() => {
    refreshAll();
    startPolling();
  });

  context.subscriptions.push({
    dispose() {
      if (pollTimer) { clearInterval(pollTimer); }
    },
  });
}

async function initializeConnection(client: EnkakuClient): Promise<void> {
  const healthy = await client.checkHealth();
  if (!healthy) {
    const action = await vscode.window.showWarningMessage(
      "Cannot connect to Enkaku server. Is it running?",
      "Configure",
      "Retry",
    );
    if (action === "Configure") {
      vscode.commands.executeCommand("enkaku.configure");
    } else if (action === "Retry") {
      return initializeConnection(client);
    }
  }
}

export function deactivate(): void {
  if (pollTimer) { clearInterval(pollTimer); }
}
