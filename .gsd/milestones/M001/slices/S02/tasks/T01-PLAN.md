---
estimated_steps: 5
estimated_files: 1
---

# T01: Add port forwarding and firewall functions to WSL module

**Slice:** S02 — Automatic Port Forwarding and Cleanup
**Milestone:** M001

## Description

Expand `src/lib/wsl.ts` with four functions for managing netsh portproxy rules and Windows Firewall inbound rules from inside WSL.

## Steps

1. Add `setupPortForward(port, wslIp, lanIp)` — executes `netsh.exe interface portproxy add v4tov4` via `execFile`
2. Add `removePortForward(port, lanIp)` — executes `netsh.exe interface portproxy delete v4tov4`
3. Add `addFirewallRule(port)` — executes `netsh.exe advfirewall firewall add rule` with name `CLR-<port>`
4. Add `removeFirewallRule(port)` — deletes rule by name `CLR-<port>`
5. All functions: async, return `{ success: boolean; error?: string }`, capture stderr, never throw

## Must-Haves

- [ ] Four functions exported: `setupPortForward`, `removePortForward`, `addFirewallRule`, `removeFirewallRule`
- [ ] Each calls the real `netsh.exe` command
- [ ] Return type includes success boolean and optional error string
- [ ] `npm run build` passes

## Verification

- Functions exist in `src/lib/wsl.ts` with real netsh.exe calls
- `npm run build` succeeds

## Inputs

- `src/lib/wsl.ts` — S01/T01 output with `isWSL()`, `getWindowsLanIp()`, `getWSLInternalIp()`

## Expected Output

- `src/lib/wsl.ts` — expanded with port forwarding and firewall management functions
