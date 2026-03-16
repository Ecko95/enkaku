# S01: WSL Detection and LAN IP Resolution

**Goal:** When `clr` runs inside WSL2, detect the environment and resolve the Windows host's LAN IP so the QR code and terminal output show a reachable address. Native Linux/macOS behavior unchanged.
**Demo:** Run `clr` inside WSL2 — terminal and QR code show the Windows LAN IP (e.g. `192.168.x.x`), not the WSL internal IP (`172.x.x.x`). Run on native Linux — behavior identical to upstream.

## Must-Haves

- `src/lib/wsl.ts` exists with `isWSL()`, `getWindowsLanIp()`, `getWSLInternalIp()` — real implementations, not stubs
- `isWSL()` returns `true` inside WSL2, `false` on native Linux/macOS
- `getWindowsLanIp()` returns a `192.168.x.x` or similar LAN IP by calling `powershell.exe` from WSL
- `bin/cursor-remote.mjs` uses WSL-aware IP resolution — shows Windows LAN IP in QR code and terminal when in WSL2
- `src/lib/network.ts` `getLanIp()` returns Windows LAN IP when in WSL2
- On native platforms, both files behave exactly as before (no WSL code paths execute)

## Verification

- `node -e "import('./src/lib/wsl.ts')"` — module loads without error (via tsx or build)
- `grep -q 'isWSL\|getWindowsLanIp' bin/cursor-remote.mjs` — wiring present in CLI
- `grep -q 'isWSL\|getWindowsLanIp' src/lib/network.ts` — wiring present in network module
- On native Linux: `clr` starts and shows the same local IP as before (manual UAT)

## Tasks

- [x] **T01: Create WSL detection and IP resolution module** `est:30m`
  - Why: Central module that all WSL-aware code will import — must exist before wiring
  - Files: `src/lib/wsl.ts`
  - Do: Implement `isWSL()` (read `/proc/version`, check for "microsoft" case-insensitive, cache result), `getWindowsLanIp()` (call `powershell.exe` to get active non-virtual adapter IPv4, filter out Hyper-V/vEthernet/loopback, return first match), `getWSLInternalIp()` (return WSL's own `eth0` IPv4 from `os.networkInterfaces()`). All functions must handle errors gracefully — return `null` on failure, never throw.
  - Verify: `npx tsx -e "import { isWSL, getWindowsLanIp, getWSLInternalIp } from './src/lib/wsl.ts'; console.log({ isWSL: isWSL(), lanIp: await getWindowsLanIp(), wslIp: getWSLInternalIp() })"` runs without error
  - Done when: Module exports all three functions with real implementations

- [x] **T02: Wire WSL-aware IP into CLI and network module** `est:30m`
  - Why: The QR code and `/api/info` endpoint must show the correct IP — this is the user-visible outcome
  - Files: `bin/cursor-remote.mjs`, `src/lib/network.ts`
  - Do: In `bin/cursor-remote.mjs`: import wsl module, if `isWSL()` then call `getWindowsLanIp()` and use that instead of the native `getLanIp()`. In `src/lib/network.ts`: import wsl module, if `isWSL()` return Windows LAN IP from `getLanIp()`. Both must fall back to native behavior if WSL functions return null. Keep the bin file as ESM `.mjs` — import the wsl module dynamically or via the built path.
  - Verify: `grep -c 'isWSL\|getWindowsLanIp' bin/cursor-remote.mjs src/lib/network.ts` shows hits in both files. `npm run build` succeeds.
  - Done when: Both IP resolution sites use WSL-aware logic, build passes, native fallback preserved

## Files Likely Touched

- `src/lib/wsl.ts` (new)
- `bin/cursor-remote.mjs`
- `src/lib/network.ts`
