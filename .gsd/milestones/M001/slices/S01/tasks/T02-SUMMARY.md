---
id: T02
parent: S01
milestone: M001
provides:
  - WSL-aware getLanIp() in bin/cursor-remote.mjs (async, inline JS)
  - WSL-aware getLanIp() in src/lib/network.ts (async, imports wsl.ts)
  - getNetworkInfo() now async in network.ts
  - WSL2 indicator line in CLI startup output
  - /api/info endpoint returns Windows LAN IP when in WSL2
affects: [S02, S03]
key_files:
  - bin/cursor-remote.mjs
  - src/lib/network.ts
  - src/app/api/info/route.ts
key_decisions:
  - "Inline WSL logic in bin file rather than importing from build output: avoids build dependency for CLI entrypoint"
  - "getLanIp() made async in both locations: getWindowsLanIp() is inherently async (execFile)"
patterns_established:
  - "WSL code duplicated in bin (JS) and lib (TS) per K001 — both must stay in sync"
drill_down_paths:
  - .gsd/milestones/M001/slices/S01/tasks/T02-PLAN.md
duration: 10min
verification_result: pass
completed_at: 2026-03-16T18:15:00Z
---

# T02: Wire WSL-aware IP into CLI and network module

**Both IP resolution sites now return Windows LAN IP in WSL2, QR code and /api/info show correct address**

## What Happened

Updated `bin/cursor-remote.mjs` with inline WSL detection and IP resolution (mirrors `src/lib/wsl.ts` logic in plain JS). Updated `src/lib/network.ts` to import from `wsl.ts` and call `getWindowsLanIp()` when `isWSL()` is true. Both `getLanIp()` functions are now async. Updated `/api/info` route to await `getNetworkInfo()`. Added WSL2 indicator line to CLI startup banner.

## Deviations
None — followed the plan exactly (option b: inline JS in bin file).

## Files Created/Modified
- `bin/cursor-remote.mjs` — WSL detection + IP resolution inlined, getLanIp async, WSL indicator in output
- `src/lib/network.ts` — imports wsl.ts, getLanIp and getNetworkInfo now async
- `src/app/api/info/route.ts` — awaits getNetworkInfo()
