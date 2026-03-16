---
estimated_steps: 5
estimated_files: 1
---

# T02: Wire port forwarding into CLI startup and shutdown

**Slice:** S02 — Automatic Port Forwarding and Cleanup
**Milestone:** M001

## Description

Integrate port forwarding lifecycle into `bin/cursor-remote.mjs` — setup on start, cleanup on shutdown, status messages in terminal, and `--no-forward` flag.

## Steps

1. Add `--no-forward` flag parsing to the CLI argument handler
2. After WSL detection and IP resolution, if WSL and not `--no-forward`: call port forwarding setup, print status
3. Add firewall rule after port forward succeeds
4. In shutdown handler: remove port forward and firewall rule before killing child process
5. Handle failure: if setup fails, print warning but continue (server still works via WSL IP)

## Must-Haves

- [ ] Port forwarding set up after port resolved, before Next.js starts
- [ ] Cleanup runs on SIGINT/SIGTERM
- [ ] `--no-forward` flag skips all forwarding
- [ ] Status messages printed: detecting, forwarding, success/failure
- [ ] Server still starts even if forwarding fails

## Verification

- In WSL2: `clr` shows forwarding messages, `netsh.exe interface portproxy show v4tov4` shows rule
- Ctrl+C removes the rule
- `clr --no-forward` skips forwarding

## Inputs

- `src/lib/wsl.ts` — S02/T01 output with port forwarding functions
- `bin/cursor-remote.mjs` — S01/T02 output with WSL-aware IP resolution

## Expected Output

- `bin/cursor-remote.mjs` — full port forwarding lifecycle integrated
