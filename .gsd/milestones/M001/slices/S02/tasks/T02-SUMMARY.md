---
id: T02
parent: S02
milestone: M001
provides:
  - Port forwarding setup on CLI startup (netsh portproxy + firewall rule)
  - Port forwarding cleanup on shutdown (SIGINT/SIGTERM)
  - --no-forward flag to skip port forwarding
  - Privilege error messaging with manual commands
  - Inline netsh wrapper functions in bin file
affects: [S03]
key_files:
  - bin/cursor-remote.mjs
key_decisions:
  - "Show manual netsh commands in privilege error case — user can copy-paste into elevated PowerShell"
  - "Server still starts even if forwarding fails — accessible via WSL IP as fallback"
patterns_established:
  - "wslForwarded + wslForwardLanIp tracking for cleanup state"
drill_down_paths:
  - .gsd/milestones/M001/slices/S02/tasks/T02-PLAN.md
duration: 10min
verification_result: pass
completed_at: 2026-03-16T18:45:00Z
---

# T02: Wire port forwarding into CLI startup and shutdown

**Full port forwarding lifecycle in CLI — setup, firewall rule, cleanup on exit, --no-forward flag, privilege error fallback**

## What Happened

Added inline netsh wrapper functions to `bin/cursor-remote.mjs` (mirrors wsl.ts pattern). After port and IP resolution, if WSL and not `--no-forward`: sets up portproxy, adds firewall rule, prints status. On failure, shows manual netsh commands for elevated PowerShell. On SIGINT/SIGTERM, removes portproxy and firewall rules before killing the child process. Server still starts even if forwarding fails.

## Deviations
Merged some S03 scope (privilege error messaging) into this task since it naturally fits the setup flow. S03 will still handle stale rule cleanup and help docs.

## Files Created/Modified
- `bin/cursor-remote.mjs` — Port forwarding lifecycle, --no-forward flag, inline netsh functions
