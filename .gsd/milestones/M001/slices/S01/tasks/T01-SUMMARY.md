---
id: T01
parent: S01
milestone: M001
provides:
  - isWSL() — cached WSL2 detection via /proc/version
  - getWindowsLanIp() — async, calls powershell.exe Get-NetAdapter with ipconfig.exe fallback
  - getWSLInternalIp() — sync, reads eth0 IPv4 from os.networkInterfaces()
  - isValidIPv4() helper for IP validation
  - execPowershell() and execCommand() internal helpers
affects: [S02, S03]
key_files:
  - src/lib/wsl.ts
key_decisions:
  - "ipconfig.exe fallback when Get-NetAdapter unavailable: covers Windows Home editions"
patterns_established:
  - "WSL utility module pattern: never throw, return null/false on failure"
drill_down_paths:
  - .gsd/milestones/M001/slices/S01/tasks/T01-PLAN.md
duration: 10min
verification_result: pass
completed_at: 2026-03-16T18:00:00Z
---

# T01: Create WSL detection and IP resolution module

**WSL detection + Windows LAN IP resolution via powershell.exe with ipconfig.exe fallback, tested live in WSL2**

## What Happened

Created `src/lib/wsl.ts` with three exported functions. `isWSL()` reads `/proc/version` and caches the result. `getWindowsLanIp()` calls `powershell.exe` with `Get-NetAdapter -Physical` to find active adapters, filtering virtual/Hyper-V/WSL adapters, with a fallback to parsing `ipconfig.exe` output for Windows Home editions. `getWSLInternalIp()` reads `eth0` from `os.networkInterfaces()`. All functions handle errors gracefully — never throw, return null/false on failure. Live tested: isWSL returns true, LAN IP resolves to 192.168.0.21, WSL IP resolves to 172.17.70.8.

## Deviations
Added ipconfig.exe fallback path — not in original plan but covers Windows Home where Get-NetAdapter may not be available.

## Files Created/Modified
- `src/lib/wsl.ts` — WSL detection and IP resolution module (163 lines)
