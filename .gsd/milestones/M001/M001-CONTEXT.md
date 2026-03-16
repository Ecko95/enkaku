# M001: WSL2 Network Bridging — Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

## Project Description

Fork of cursor-local-remote that adds automatic WSL2 network bridging so the Cursor remote UI is reachable from phones and tablets on the local Wi-Fi — even when the server runs inside WSL2.

## Why This Milestone

WSL2 uses a NAT'd virtual network with its own IP range (172.x.x.x). Services bound to 0.0.0.0 inside WSL2 are not reachable from other devices on the physical network. The user's phone on Wi-Fi cannot reach the WSL internal IP. This milestone solves that gap transparently.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Run `clr` inside WSL2 and see a QR code with their Windows LAN IP
- Scan that QR code from their phone and connect to the Cursor remote UI
- Stop the server and have all port forwarding cleaned up automatically

### Entry point / environment

- Entry point: `clr` CLI command
- Environment: WSL2 on Windows (primary), native Linux/macOS (must not regress)
- Live dependencies involved: Windows netsh.exe, powershell.exe (called from WSL)

## Completion Class

- Contract complete means: WSL detection works, LAN IP is resolved correctly, port forwarding is set up and torn down
- Integration complete means: Phone on same Wi-Fi can reach the server through the forwarded port
- Operational complete means: Cleanup happens on SIGINT/SIGTERM, stale rules are handled on startup

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- Running `clr` in WSL2 shows the Windows LAN IP in QR code and terminal output
- A phone on the same Wi-Fi network can open that URL and interact with the Cursor remote UI
- Stopping `clr` removes the portproxy and firewall rules
- Running `clr` on native Linux continues to work exactly as before

## Risks and Unknowns

- `netsh.exe` portproxy requires admin privileges — may fail in unprivileged WSL sessions
- Windows Firewall may block inbound connections even with portproxy configured
- Multiple network adapters on Windows could return the wrong LAN IP
- Calling `powershell.exe` from WSL has startup latency (~1-2 seconds)

## Existing Codebase / Prior Art

- `bin/cursor-remote.mjs` — CLI entrypoint, has its own `getLanIp()`, generates QR code, manages shutdown
- `src/lib/network.ts` — `getLanIp()` and `getNetworkInfo()` used by API routes
- `src/lib/shutdown.ts` — shutdown handler, kills processes on SIGTERM/SIGINT
- `src/app/api/info/route.ts` — returns network info to the frontend

> See `.gsd/DECISIONS.md` for all architectural and pattern decisions.

## Relevant Requirements

- R001 — WSL detection gates all WSL-specific behavior
- R002 — Windows LAN IP resolution is the core networking fix
- R003, R005, R006 — Port forwarding lifecycle
- R004 — QR code correctness is the user-visible outcome
- R007 — No regression on native platforms
- R008 — Graceful failure when admin privileges unavailable

## Scope

### In Scope

- WSL2 detection via /proc/version
- Windows LAN IP resolution via powershell.exe/ipconfig.exe
- netsh portproxy setup and teardown
- Windows Firewall inbound rule management
- QR code and terminal output showing correct IP
- Graceful fallback with clear instructions when admin unavailable

### Out of Scope / Non-Goals

- WSL mirrored networking detection (deferred)
- Bridged/static IP WSL configurations
- Any changes to the web UI itself
- Any changes to the Cursor CLI interaction layer

## Technical Constraints

- Must call Windows executables (powershell.exe, netsh.exe) from inside WSL
- Port forwarding needs to map Windows LAN IP:port → WSL internal IP:port
- Cleanup must handle both graceful shutdown and process kills
- getLanIp() exists in two places (bin/cursor-remote.mjs and src/lib/network.ts) — both need the WSL path

## Integration Points

- powershell.exe — called from WSL to discover Windows network adapters
- netsh.exe — called from WSL to manage portproxy rules and firewall rules
- /proc/version — read to detect WSL2 environment

## Open Questions

- Whether the user's WSL environment runs with admin-capable permissions by default — testable during S02
