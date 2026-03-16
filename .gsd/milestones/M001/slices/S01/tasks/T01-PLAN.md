---
estimated_steps: 4
estimated_files: 1
---

# T01: Create WSL detection and IP resolution module

**Slice:** S01 — WSL Detection and LAN IP Resolution
**Milestone:** M001

## Description

Create `src/lib/wsl.ts` with three functions: `isWSL()` for environment detection, `getWindowsLanIp()` to resolve the Windows host's real LAN IP via `powershell.exe`, and `getWSLInternalIp()` to get the WSL adapter's own IP. This module is the foundation for all WSL-aware behavior.

## Steps

1. Create `src/lib/wsl.ts`
2. Implement `isWSL()` — read `/proc/version` synchronously, check for "microsoft" (case-insensitive), cache the result. Return `false` on any read error (gracefully handles non-Linux platforms).
3. Implement `getWindowsLanIp()` — async function that calls `powershell.exe -NoProfile -NonInteractive -Command` with a script that gets active network adapter IPv4 addresses, filtering out Hyper-V virtual switches, vEthernet adapters, WSL adapters, and loopback. Return the first matching IP or `null` on failure.
4. Implement `getWSLInternalIp()` — synchronous function using `os.networkInterfaces()` to find the `eth0` IPv4 address (this is the WSL internal IP that port forwarding targets). Return `null` if not found.

## Must-Haves

- [ ] `src/lib/wsl.ts` exists with real implementations (not stubs)
- [ ] `isWSL()` exported — reads /proc/version, caches result, returns boolean
- [ ] `getWindowsLanIp()` exported — async, calls powershell.exe, returns string | null
- [ ] `getWSLInternalIp()` exported — sync, returns WSL eth0 IPv4 or null
- [ ] All functions handle errors gracefully — return null/false on failure, never throw

## Verification

- File exists and has substantive content (>50 lines)
- `npx tsx -e "import { isWSL, getWindowsLanIp, getWSLInternalIp } from './src/lib/wsl.ts'; console.log({ isWSL: isWSL(), lanIp: await getWindowsLanIp(), wslIp: getWSLInternalIp() })"` — runs without error
- `npm run build` succeeds

## Inputs

- `src/lib/network.ts` — existing pattern for `getLanIp()` using `os.networkInterfaces()`
- D001: WSL detection via /proc/version
- D002: Windows LAN IP via powershell.exe
- D004: All WSL logic in src/lib/wsl.ts

## Expected Output

- `src/lib/wsl.ts` — WSL detection and IP resolution module, exports `isWSL`, `getWindowsLanIp`, `getWSLInternalIp`
