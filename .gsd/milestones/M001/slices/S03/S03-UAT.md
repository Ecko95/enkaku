# S03: Resilience and Fallback UX — UAT

## Test Steps

### 1. Stale Rule Cleanup
1. Start `clr`, then kill it with `kill -9` (simulate crash without cleanup)
2. Verify stale rule: `netsh.exe interface portproxy show v4tov4` — should show the rule
3. Start `clr` again
4. **Expect:** See "🧹 Cleaned stale port forward rule" before "⚡ Setting up port forwarding..."

### 2. --no-forward in Help
1. Run `clr --help`
2. **Expect:** `--no-forward` option is listed with description

### 3. Native Platform
1. On native Linux/macOS, run `clr`
2. **Expect:** No WSL messages, no stale rule checks, normal behavior
