---
estimated_steps: 4
estimated_files: 2
---

# T02: Wire WSL-aware IP into CLI and network module

**Slice:** S01 — WSL Detection and LAN IP Resolution
**Milestone:** M001

## Description

Update both IP resolution sites (`bin/cursor-remote.mjs` and `src/lib/network.ts`) to use the WSL module when running inside WSL2. The QR code, terminal output, and `/api/info` endpoint will all show the Windows LAN IP. Native platform behavior is preserved via `isWSL()` gating.

## Steps

1. Update `src/lib/network.ts` — import `isWSL` and `getWindowsLanIp` from `./wsl`. Make `getLanIp()` async. If `isWSL()`, call `getWindowsLanIp()` first; fall back to native resolution if it returns null. Update `getNetworkInfo()` to be async accordingly.
2. Update callers of `getLanIp()` / `getNetworkInfo()` — `src/app/api/info/route.ts` already uses async route handlers so just await the result.
3. Update `bin/cursor-remote.mjs` — the bin file is plain ESM JS and can't directly import TS. Two options: (a) dynamically import the built wsl module from `.next/`, or (b) duplicate the WSL detection logic in plain JS in the bin file. Option (b) is more robust since the bin file runs before Next.js starts. Implement `isWSL()` and `getWindowsLanIp()` as inline JS functions in the bin file, mirroring the TS module's logic. This avoids a build dependency for the CLI entrypoint.
4. Test: `npm run build` succeeds, grep confirms wiring in both files.

## Must-Haves

- [ ] `src/lib/network.ts` `getLanIp()` returns Windows LAN IP when `isWSL()` is true
- [ ] `bin/cursor-remote.mjs` `getLanIp()` returns Windows LAN IP when in WSL2
- [ ] Both fall back to native behavior when WSL functions return null
- [ ] On native platforms, no WSL code paths execute (gated behind `isWSL()`)
- [ ] `npm run build` succeeds
- [ ] QR code URL in terminal uses the resolved Windows LAN IP

## Verification

- `npm run build` — passes
- `grep -c 'isWSL\|getWindowsLanIp\|wsl' bin/cursor-remote.mjs` — shows hits
- `grep -c 'isWSL\|getWindowsLanIp\|wsl' src/lib/network.ts` — shows hits
- On WSL2: `clr` shows Windows LAN IP in terminal output (manual UAT)
- On native: `clr` shows native LAN IP as before (manual UAT)

## Inputs

- `src/lib/wsl.ts` — T01 output, exports `isWSL`, `getWindowsLanIp`, `getWSLInternalIp`
- `bin/cursor-remote.mjs` — existing CLI entrypoint with `getLanIp()` function
- `src/lib/network.ts` — existing network module with `getLanIp()` and `getNetworkInfo()`
- K001: getLanIp() exists in TWO places

## Expected Output

- `bin/cursor-remote.mjs` — updated with WSL-aware IP resolution
- `src/lib/network.ts` — updated with WSL-aware IP resolution
- `src/app/api/info/route.ts` — may need minor update if `getNetworkInfo` becomes async
