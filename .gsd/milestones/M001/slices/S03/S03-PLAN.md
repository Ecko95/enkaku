# S03: Resilience and Fallback UX

**Goal:** Handle failure cases gracefully — admin privilege errors show clear instructions, stale rules from previous crashes are cleaned up on startup, and the overall experience is polished.
**Demo:** Start `clr` in WSL2 without admin privileges — see clear instructions on how to fix it. Start `clr` after a previous crash — stale rules are detected and cleaned.

## Must-Haves

- When netsh fails due to insufficient privileges, terminal shows the exact commands to run manually
- On startup, check for stale portproxy rules from a previous `clr` instance and clean them
- `--no-forward` flag documented in `--help` output
- No regression on native platforms

## Verification

- Help output includes `--no-forward` flag
- Build passes: `npm run build`
- On native Linux: `clr --help` works, no WSL messages shown

## Tasks

- [x] **T01: Stale rule cleanup and privilege error messaging** `est:30m`
  - Why: Covers the two main failure modes — stale rules from crashes and missing admin privileges
  - Files: `src/lib/wsl.ts`, `bin/cursor-remote.mjs`
  - Do: Add `checkStaleRules(port)` to wsl module — queries existing portproxy rules, returns boolean if a rule for the port exists. On startup (before setting up new rules), check and remove stale rules. When `setupPortForward` or `addFirewallRule` fails, detect if it's a permission error (stderr contains "Access is denied" or "requires elevation"). If so, print a boxed message with the exact netsh commands the user can run in an elevated PowerShell. Update `--help` to document `--no-forward`. Ensure `--no-forward` skips all port forwarding logic cleanly.
  - Verify: `clr --help` shows `--no-forward`. `npm run build` passes. Code paths for stale cleanup and error messaging exist in the bin file.
  - Done when: Stale rule cleanup runs on startup, privilege errors show actionable instructions, `--no-forward` is documented

## Files Likely Touched

- `src/lib/wsl.ts`
- `bin/cursor-remote.mjs`
