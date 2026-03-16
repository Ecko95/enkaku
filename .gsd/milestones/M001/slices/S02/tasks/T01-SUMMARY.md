---
id: T01
parent: S02
milestone: M001
provides:
  - setupPortForward(port, wslIp, lanIp) — netsh portproxy add v4tov4
  - removePortForward(port, lanIp) — netsh portproxy delete v4tov4
  - addFirewallRule(port) — netsh advfirewall firewall add rule
  - removeFirewallRule(port) — netsh advfirewall firewall delete rule
  - NetshResult type — { success: boolean; error?: string }
  - execNetsh() helper for all netsh calls
affects: [S03]
key_files:
  - src/lib/wsl.ts
  - src/lib/network.ts
key_decisions:
  - "Dynamic import of wsl.ts in network.ts: static import caused Next.js prerender failure because child_process/fs get bundled"
patterns_established:
  - "NetshResult pattern: all netsh wrappers return { success, error? }, never throw"
drill_down_paths:
  - .gsd/milestones/M001/slices/S02/tasks/T01-PLAN.md
duration: 15min
verification_result: pass
completed_at: 2026-03-16T18:30:00Z
---

# T01: Add port forwarding and firewall functions to WSL module

**Four netsh.exe wrapper functions for portproxy and firewall management, plus build fix for dynamic wsl.ts import**

## What Happened

Added `setupPortForward`, `removePortForward`, `addFirewallRule`, `removeFirewallRule` to `src/lib/wsl.ts`. All use a shared `execNetsh()` helper that captures stderr for error reporting. Return `NetshResult` with success boolean and optional error string. Also fixed a build regression: static import of `wsl.ts` in `network.ts` caused Next.js prerender failure at `/` because `child_process` and `fs` got pulled into the webpack bundle. Switched to dynamic `await import("./wsl")` in `network.ts`.

## Deviations
Added build fix (dynamic import in network.ts) — not in the plan but required for the build to pass.

## Files Created/Modified
- `src/lib/wsl.ts` — Four netsh wrapper functions + NetshResult type + execNetsh helper (275 lines total)
- `src/lib/network.ts` — Changed to dynamic import of wsl.ts to fix Next.js prerender
