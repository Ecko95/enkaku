---
id: S03
milestone: M001
provides:
  - checkStaleRules(port) in wsl.ts
  - Stale rule cleanup on startup
affects: []
key_files:
  - src/lib/wsl.ts
  - bin/cursor-remote.mjs
drill_down_paths:
  - .gsd/milestones/M001/slices/S03/tasks/T01-SUMMARY.md
verification_result: pass
completed_at: 2026-03-16T19:00:00Z
---

# S03: Resilience and Fallback UX

**Stale portproxy rule detection and cleanup on startup; --help and privilege error messaging already complete from S02**

## What Happened

Added `checkStaleRules(port)` to detect leftover portproxy rules from crashed sessions. On startup, before setting up new rules, checks for and removes stale rules. The privilege error messaging and `--no-forward` help docs were completed ahead of schedule in S02.
