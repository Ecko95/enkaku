# S02: Automatic Port Forwarding and Cleanup

**Goal:** When `clr` starts in WSL2, automatically set up netsh portproxy and firewall rules so the server is reachable from the LAN. On shutdown, remove those rules.
**Demo:** Run `clr` in WSL2, scan QR from phone, phone connects and can interact with the Cursor remote UI. Stop `clr` — portproxy and firewall rules are gone.

## Must-Haves

- Port forwarding via `netsh interface portproxy add v4tov4` is set up on startup
- Firewall inbound rule is added for the port
- Phone on same Wi-Fi can reach the server via the Windows LAN IP
- On shutdown (SIGINT/SIGTERM), portproxy and firewall rules are removed
- On native platforms, no port forwarding code executes

## Proof Level

- This slice proves: integration
- Real runtime required: yes (WSL2 + phone on network)
- Human/UAT required: yes (phone connectivity test)

## Verification

- After `clr` starts in WSL2: `netsh.exe interface portproxy show v4tov4` shows the rule
- After `clr` stops: same command shows no rule for the port
- Phone on Wi-Fi can open the URL shown in the QR code

## Tasks

- [ ] **T01: Add port forwarding and firewall functions to WSL module** `est:30m`
  - Why: Core port forwarding logic — must exist before the CLI can call it
  - Files: `src/lib/wsl.ts`
  - Do: Add `setupPortForward(port, wslIp, lanIp)` — runs `netsh.exe interface portproxy add v4tov4 listenport=<port> listenaddress=<lanIp> connectport=<port> connectaddress=<wslIp>`. Add `removePortForward(port, lanIp)` — runs `netsh.exe interface portproxy delete v4tov4 listenport=<port> listenaddress=<lanIp>`. Add `addFirewallRule(port)` — `netsh.exe advfirewall firewall add rule name="CLR-<port>" dir=in action=allow protocol=TCP localport=<port>`. Add `removeFirewallRule(port)` — delete by name. All functions async, return success boolean, capture stderr for error reporting. Never throw.
  - Verify: Functions exist in module, `npm run build` passes
  - Done when: All four functions exported with real netsh.exe calls, error handling included

- [ ] **T02: Wire port forwarding into CLI startup and shutdown** `est:30m`
  - Why: The user-visible outcome — port forwarding happens automatically when `clr` starts
  - Files: `bin/cursor-remote.mjs`
  - Do: After port is resolved and before Next.js starts: if WSL, call setup functions (inline JS mirroring wsl.ts pattern). On shutdown, call remove functions before killing the child process. Add a `--no-forward` flag to skip port forwarding. Print status messages: "⚡ WSL2 detected — forwarding port...", "✓ Port forwarded", "✗ Port forwarding failed (need admin?)". Handle the case where forwarding fails but server still starts — show the WSL IP as fallback with instructions.
  - Verify: `clr` in WSL2 prints forwarding status, `netsh.exe interface portproxy show v4tov4` shows rule, Ctrl+C removes it
  - Done when: Full lifecycle works — start adds rules, stop removes them, failure is handled gracefully

## Files Likely Touched

- `src/lib/wsl.ts`
- `bin/cursor-remote.mjs`
