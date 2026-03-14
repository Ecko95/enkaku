# Cursor Local Remote

Control Cursor from your phone, tablet or any browser on your local network. Great for monitoring and nudging Cursor while in the bathroom, watching a movie or cooking food.

A local web UI that talks to Cursor's CLI agent on your machine. No cloud, accounts or other bs just on your local network. Also added some rudamentary security so that you need a key to access it incase you have many in a Wifi network. Important to only use this on trusted network that are safe, because the security is easy to bruteforce if you are in the same network.

## Demo
https://github.com/user-attachments/assets/6b2284fd-0e3d-46c9-ae63-86bbd672ad72



## Good to know

This is essentially an easy way to use the Cursor CLI from your phone or any other device on your network.

You can **start new sessions** from the remote UI and they work fully: the agent runs, edits files, executes commands, everything. However, sessions started remotely won't appear in Cursor's desktop sidebar. This is a Cursor limitation, it stores conversation state in an internal in-memory store that can't be written from outside the process.

The remote UI can see **all** sessions, both ones started in the IDE and ones started remotely. You can monitor active desktop sessions in real time, browse and resume past sessions, or start fresh ones. Messages sent from the remote won't show up in the IDE's chat view, but the work the agent does (file edits, commands) happens on your machine either way.

## Install

```bash
npm install -g cursor-local-remote
```

Then start it:

```bash
clr
```

A QR code pops up in your terminal — scan it from your phone and you're connected.

## Features

- **QR connect** — scan to connect your phone instantly and continue with phone coding session
- **Full agent control** — send prompts, pick models, switch modes, stop/retry from any device
- **Live streaming** — watch responses, tool calls, and file edits in real time
- **Multi-project** — switch between all your Cursor projects, star favorites, browse sessions across workspaces
- **Git panel** — view diffs, commit, push, pull, switch branches — all from the UI
- **Session management** — browse, resume, archive, and export past sessions
- **PWA ready** — install as an app on your phone's home screen

## Usage

`clr` is the short alias for `cursor-local-remote`.

```
clr [workspace] [options]
```

| Option | Description |
| --- | --- |
| `workspace` | Path to your project folder (defaults to cwd) |
| `-p, --port` | Port to run on (default: `3100`) |
| `--no-open` | Don't auto-open the browser |
| `--no-qr` | Don't show QR code in terminal |
| `--no-trust` | Disable workspace trust (agent will ask before actions) |
| `-v, --verbose` | Show all server and agent output |

```bash
clr                          # current folder
clr ~/projects/my-app        # specific project
clr --port 8080              # different port
clr --no-open --no-qr        # headless-friendly
```

## How it works

```
Phone / tablet / browser  ── LAN ──>  Next.js (0.0.0.0:3100)  ──>  cursor CLI (agent)
                          <─ stream ─
```

The CLI starts a pre-built Next.js server on your machine. When you send a prompt, the server spawns a headless `agent` process (`agent -p <prompt> --output-format stream-json`) and streams the NDJSON output back to the browser over HTTP. Session history comes from reading Cursor's own transcript files in `~/.cursor/projects/`, so you see all sessions, not just ones started from this tool.

### Authentication

Every launch generates a memorable word-pair token (e.g. `alpine-berry`) printed in the terminal. You can set a fixed token via the `AUTH_TOKEN` env var. Access is granted by:

1. Scanning the QR code (encodes the network URL with the token)
2. Visiting the URL with `?token=<token>` (sets an `httpOnly` cookie for 7 days)
3. Passing `Authorization: Bearer <token>` for API calls

### API

All endpoints require a valid token (cookie or `Bearer` header).

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/chat` | `POST` | Send a prompt. Body: `{ prompt, sessionId?, model?, mode?, workspace? }` |
| `/api/models` | `GET` | List available models from `agent models` (cached 5 min) |
| `/api/sessions` | `GET` | Session list. `?workspace=<path>` to filter, `?archived=true` to include archived |
| `/api/sessions` | `PATCH` | Archive/unarchive sessions. Body: `{ action, sessionId? }` |
| `/api/sessions` | `DELETE` | Delete a stored session. Body: `{ sessionId }` |
| `/api/sessions/active` | `GET` | List currently running agent session IDs |
| `/api/sessions/active` | `DELETE` | Kill a running agent process. Body: `{ sessionId }` |
| `/api/sessions/history` | `GET` | Full transcript for a session. `?id=<sessionId>&workspace=<path>` |
| `/api/sessions/watch` | `GET` | SSE stream for live session updates. `?id=<sessionId>&workspace=<path>` |
| `/api/projects` | `GET` | List all discovered Cursor projects |
| `/api/git` | `GET` | Git status, diffs, and branches. `?workspace=<path>&detail=status\|diff\|branches` |
| `/api/git` | `POST` | Git actions. Body: `{ action, workspace?, message?, files?, branch? }` |
| `/api/upload` | `POST` | Upload images (multipart/form-data) |
| `/api/settings` | `GET` | Get current settings |
| `/api/settings` | `PATCH` | Update settings. Body: `{ key, value }` |
| `/api/info` | `GET` | Network info, auth URL, and workspace path |

### Environment variables

| Variable | Description |
| --- | --- |
| `AUTH_TOKEN` | Fixed auth token (otherwise randomly generated each launch) |
| `CURSOR_WORKSPACE` | Workspace path (set automatically by the CLI) |
| `CURSOR_TRUST` | Set to `1` to pass `--trust` to the agent (auto-approve all tool calls) |
| `PORT` | Server port (default: `3100`) |

## Requirements

- [Node.js](https://nodejs.org/) 20+
- [Cursor](https://cursor.com) with the CLI installed (`agent --version` should work)
- A Cursor subscription (Pro, Team, etc.)

## Development

Contributions are welcome. Mainly created this so that I can use cursor when I don't feel like being at my desk. Whole project vibecoded with cursor, obviously.

```bash
git clone https://github.com/jon-makinen/cursor-local-remote.git
cd cursor-local-remote
npm install
npm run dev
```

## License

MIT
