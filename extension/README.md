# Enkaku Sync — VS Code / Cursor Extension

View and continue remote Enkaku agent sessions directly from your IDE. Start a chat on your phone, then come back to Cursor to review every file change, diff, and conversation turn.

## Quick Start

### 1. Build the extension

```bash
cd extension
npm install
npm run compile
```

### 2. Install into Cursor

Symlink the extension directory so Cursor picks it up:

```bash
# WSL2 / Linux (Cursor remote server)
ln -sf "$(pwd)" ~/.cursor-server/extensions/ecko95.enkaku-sync-0.1.0

# macOS / native Linux (Cursor desktop)
ln -sf "$(pwd)" ~/.cursor/extensions/ecko95.enkaku-sync-0.1.0
```

Reload Cursor: `Ctrl+Shift+P` → **Developer: Reload Window**.

### 3. Start the Enkaku server

```bash
# From the project root
npm run dev
```

The terminal will print the server URL and auth token you need.

### 4. Connect the extension

Open the command palette (`Ctrl+Shift+P`) and run **Enkaku: Configure Server Connection**. Enter the server URL and auth token printed in step 3.

Alternatively, add these to your `settings.json`:

```json
{
  "enkaku.serverUrl": "http://localhost:3100",
  "enkaku.authToken": "your-token-here"
}
```

## Using the Extension

### Activity Bar

Once connected, an **Enkaku** icon appears in the activity bar (left sidebar). Click it to open two panels:

- **Sessions** — lists all discovered sessions, grouped as _Remote_ (started from phone/tablet) or _Local_ (started in this IDE).
- **Changed Files** — shows every file modified by the currently selected session, with edit/write counts.

### Viewing a Session

Click any session in the sidebar to open a **Session Detail** webview panel showing:

- **Tool Activity** — badge summary of reads, writes, edits, and shell commands.
- **Changed Files** — clickable file paths that open the file in the editor.
- **Conversation** — the full user/assistant chat history.

### Continuing a Session

Right-click a remote session and choose **Continue This Session in Chat** to resume it in a Cursor terminal. This runs the `cursor agent` CLI with the session ID so you can pick up right where you left off.

### Opening in the Browser

Right-click a session and choose **Open in Enkaku Web UI** to jump to the web interface on that session.

## Commands

| Command | Description |
|---------|-------------|
| `Enkaku: Refresh Sessions` | Force-refresh the session list |
| `Enkaku: View Session Details` | Open conversation + changes in a webview panel |
| `Enkaku: Continue This Session in Chat` | Resume a session via `cursor agent` CLI |
| `Enkaku: Open in Enkaku Web UI` | Open the session in your browser |
| `Enkaku: Configure Server Connection` | Set server URL and auth token |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `enkaku.serverUrl` | `""` | Enkaku server URL (e.g. `http://192.168.1.50:3100`) |
| `enkaku.authToken` | `""` | Auth token for the server |
| `enkaku.pollIntervalSeconds` | `10` | How often to poll for new sessions (3–120 seconds) |
| `enkaku.showRemoteOnly` | `false` | Hide local sessions and only show remote ones |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Cannot connect to Enkaku server" on startup | Make sure the server is running (`npm run dev` in the project root). Check the URL and token in settings. |
| Sessions list is empty | Verify at least one agent session exists. Try **Enkaku: Refresh Sessions**. |
| QR code IP unreachable from phone | If running in WSL2, ensure the Enkaku WSL2 bridging is active so the Windows LAN IP is used. |
| Extension not visible in sidebar | Confirm the symlink is correct and you reloaded the window. Run `ls -la ~/.cursor-server/extensions/` to check. |
