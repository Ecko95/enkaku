# M001: WSL2 Network Bridging

**Vision:** When running cursor-local-remote inside WSL2, automatically detect the environment, resolve the Windows LAN IP, forward the port, and display a QR code that phones on the same Wi-Fi can actually reach.

## Success Criteria

- QR code shows the Windows LAN IP when running inside WSL2
- Phone on the same Wi-Fi can connect to the server via that QR code
- Port forwarding is set up automatically on start and removed on exit
- Clear guidance shown when admin privileges are unavailable
- No behavior change on native Linux/macOS

## Key Risks / Unknowns

- netsh portproxy requires admin privileges — may fail in standard WSL sessions
- Multiple Windows network adapters could yield the wrong LAN IP
- powershell.exe call latency from WSL (~1-2s)

## Proof Strategy

- Admin privileges risk → retire in S02 by attempting netsh and handling failure
- Wrong adapter risk → retire in S01 by filtering for active non-virtual adapters

## Verification Classes

- Contract verification: unit-level checks for WSL detection, IP parsing, cleanup
- Integration verification: port reachable from Windows host, QR code shows correct IP
- Operational verification: cleanup on SIGINT/SIGTERM, stale rule handling on startup
- UAT / human verification: phone on Wi-Fi can scan QR and use the remote UI

## Milestone Definition of Done

This milestone is complete only when all are true:

- WSL2 detection correctly identifies WSL environments and skips on native platforms
- Windows LAN IP is resolved and displayed in QR code and terminal
- Port forwarding works end-to-end: phone can reach the server
- Port forwarding and firewall rules are cleaned up on exit
- Fallback messaging works when admin privileges are missing
- Native Linux/macOS behavior is unchanged

## Requirement Coverage

- Covers: R001, R002, R003, R004, R005, R006, R007, R008
- Partially covers: none
- Leaves for later: R009
- Orphan risks: none

## Slices

- [x] **S01: WSL detection and LAN IP resolution** `risk:medium` `depends:[]`
  > After this: `clr` inside WSL2 shows the Windows LAN IP in terminal output and QR code; native platforms unchanged

- [x] **S02: Automatic port forwarding and cleanup** `risk:high` `depends:[S01]`
  > After this: phone on same Wi-Fi can reach the server running inside WSL2 via the QR code URL

- [ ] **S03: Resilience and fallback UX** `risk:low` `depends:[S02]`
  > After this: clear terminal guidance when admin privileges are unavailable; stale rules cleaned on startup

## Boundary Map

### S01 → S02

Produces:
- `src/lib/wsl.ts` → `isWSL()`, `getWindowsLanIp()`, `getWSLInternalIp()`
- Updated `bin/cursor-remote.mjs` → uses WSL-aware IP resolution for QR code and terminal output
- Updated `src/lib/network.ts` → `getLanIp()` returns Windows LAN IP when in WSL2

Consumes:
- nothing (first slice)

### S02 → S03

Produces:
- `src/lib/wsl.ts` expanded → `setupPortForward(port, wslIp, lanIp)`, `removePortForward(port)`, `addFirewallRule(port)`, `removeFirewallRule(port)`
- Updated `bin/cursor-remote.mjs` → calls setup on start, cleanup on shutdown
- Port forwarding lifecycle integrated into server startup and shutdown

Consumes from S01:
- `wsl.ts` → `isWSL()`, `getWindowsLanIp()`, `getWSLInternalIp()`

### S01 → S03

Produces:
- `isWSL()` — used to gate all resilience checks

Consumes:
- nothing (first slice)
