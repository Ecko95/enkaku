# Enkaku — Cursor Local Remote (WSL2 Fork)

## What This Is

A fork of cursor-local-remote that adds WSL2 network bridging. The upstream tool lets you control Cursor IDE from your phone via a local web UI with QR code authentication. This fork adds automatic WSL2 detection, Windows LAN IP resolution, and port forwarding so the server is reachable from any device on the Wi-Fi network — even when running inside WSL2.

## Core Value

When running `clr` inside WSL2, the QR code shows the correct Windows LAN IP and the port is automatically forwarded so your phone can connect without any manual networking setup.

## Current State

Upstream cursor-local-remote v0.1.7 cloned. Fully functional on native Linux/macOS. Inside WSL2, the server starts but the QR code shows the WSL internal IP (172.x.x.x) which is unreachable from other devices on the network.

## Architecture / Key Patterns

- Next.js 15 app with App Router, Tailwind CSS 4, React 19
- CLI entrypoint: `bin/cursor-remote.mjs` — spawns Next.js server, generates auth token, shows QR code
- Network resolution: `src/lib/network.ts` — `getLanIp()` returns first non-internal IPv4
- API routes: `src/app/api/info/route.ts` uses `getNetworkInfo()` for the `/api/info` endpoint
- Shutdown handler: `src/lib/shutdown.ts` — registered via `src/instrumentation.ts`

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [ ] M001: WSL2 Network Bridging — Detect WSL2, resolve Windows LAN IP, auto-forward ports, clean up on exit
