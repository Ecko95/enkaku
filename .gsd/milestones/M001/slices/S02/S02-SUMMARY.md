---
id: S02
milestone: M001
provides:
  - setupPortForward, removePortForward, addFirewallRule, removeFirewallRule in wsl.ts
  - NetshResult type for all netsh operations
  - Port forwarding lifecycle in bin/cursor-remote.mjs (setup on start, cleanup on exit)
  - --no-forward flag
  - Privilege error messaging with manual netsh commands
  - Dynamic import fix for wsl.ts in network.ts (prevents Next.js prerender failure)
affects: [S03]
key_files:
  - src/lib/wsl.ts
  - bin/cursor-remote.mjs
  - src/lib/network.ts
key_decisions:
  - "Dynamic import of wsl.ts in network.ts to avoid bundling child_process into client"
  - "Server continues even if port forwarding fails — shows WSL IP as fallback"
  - "Manual netsh commands shown on privilege errors"
patterns_established:
  - "NetshResult pattern for all netsh wrappers"
  - "wslForwarded state tracking for cleanup"
drill_down_paths:
  - .gsd/milestones/M001/slices/S02/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T02-SUMMARY.md
verification_result: pass
completed_at: 2026-03-16T18:45:00Z
---

# S02: Automatic Port Forwarding and Cleanup

**netsh portproxy + firewall rule setup on start, cleanup on exit, --no-forward flag, privilege error fallback with manual commands**

## What Happened

Expanded `src/lib/wsl.ts` with four netsh wrapper functions for portproxy and firewall management, all returning `NetshResult`. Fixed a build regression where static import of wsl.ts caused Next.js prerender failure — switched to dynamic import. Integrated full port forwarding lifecycle into `bin/cursor-remote.mjs`: setup after port resolution, firewall rule after portproxy, cleanup in shutdown handler. Added `--no-forward` flag. Server gracefully handles forwarding failures — shows manual commands on privilege errors.

## What's Ready for S03

S03 needs to add stale rule cleanup on startup and polish the `--help` docs. The privilege error messaging already exists from S02/T02. S03 focuses on the `checkStaleRules` function and startup cleanup logic.
