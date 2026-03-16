---
estimated_steps: 4
estimated_files: 2
---

# T01: Stale rule cleanup and privilege error messaging

**Slice:** S03 — Resilience and Fallback UX
**Milestone:** M001

## Description

Add stale portproxy rule detection/cleanup on startup, clear privilege error messaging with manual commands, and document the `--no-forward` flag in help output.

## Steps

1. Add `checkStaleRules(port)` to `src/lib/wsl.ts` — runs `netsh.exe interface portproxy show v4tov4`, parses output, returns boolean if port is already forwarded
2. In `bin/cursor-remote.mjs`: before setting up new rules, call stale check and remove if found, print "🧹 Cleaned stale port forward rule"
3. When `setupPortForward` or `addFirewallRule` returns `{ success: false }`: check if error contains "Access is denied" or "elevation", print boxed message with exact manual commands
4. Add `--no-forward` to `--help` output text

## Must-Haves

- [ ] `checkStaleRules(port)` exported from wsl.ts
- [ ] Stale rules cleaned on startup before new setup
- [ ] Privilege errors show actionable manual commands
- [ ] `--help` documents `--no-forward`
- [ ] `npm run build` passes

## Verification

- `clr --help` includes `--no-forward`
- `npm run build` passes
- Code inspection: stale check + privilege error handling present

## Inputs

- `src/lib/wsl.ts` — S02/T01 output with forwarding functions
- `bin/cursor-remote.mjs` — S02/T02 output with forwarding lifecycle

## Expected Output

- `src/lib/wsl.ts` — expanded with `checkStaleRules`
- `bin/cursor-remote.mjs` — stale cleanup, privilege error messaging, updated help
