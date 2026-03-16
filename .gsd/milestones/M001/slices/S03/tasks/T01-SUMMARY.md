---
id: T01
parent: S03
milestone: M001
provides:
  - checkStaleRules(port) in wsl.ts — detects existing portproxy rules
  - Stale rule cleanup on startup in bin/cursor-remote.mjs
  - Inline checkStaleRules in bin file
affects: []
key_files:
  - src/lib/wsl.ts
  - bin/cursor-remote.mjs
key_decisions: []
patterns_established: []
drill_down_paths:
  - .gsd/milestones/M001/slices/S03/tasks/T01-PLAN.md
duration: 10min
verification_result: pass
completed_at: 2026-03-16T19:00:00Z
---

# T01: Stale rule cleanup and privilege error messaging

**checkStaleRules() detects leftover portproxy rules from crashed sessions, auto-cleans before setup**

## What Happened

Added `checkStaleRules(port)` to `src/lib/wsl.ts` — queries `netsh.exe interface portproxy show v4tov4`, parses output for matching port. Added inline version to `bin/cursor-remote.mjs`. Wired into startup: before setting up new rules, checks for and removes stale rules with a "🧹 Cleaned stale port forward rule" message. The `--help` docs and privilege error messaging were already done in S02.

## Deviations
Steps 3 and 4 from the plan (privilege error messaging and --help docs) were already completed in S02/T02. Only stale rule detection/cleanup was new work.

## Files Created/Modified
- `src/lib/wsl.ts` — Added checkStaleRules() function
- `bin/cursor-remote.mjs` — Inline checkStaleRules, stale cleanup before port forward setup
