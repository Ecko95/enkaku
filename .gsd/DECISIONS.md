# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? |
|---|------|-------|----------|--------|-----------|------------|
| D001 | M001 | arch | WSL2 detection method | /proc/version contains "microsoft" | Reliable, no external calls, instant | No |
| D002 | M001 | arch | Windows LAN IP resolution | powershell.exe called from WSL | Can filter adapters, reliable across Windows versions | Yes — if latency is unacceptable |
| D003 | M001 | arch | Port forwarding mechanism | netsh interface portproxy v4tov4 | Standard Windows approach, works from WSL | No |
| D004 | M001 | arch | WSL module location | src/lib/wsl.ts (single module) | All WSL logic centralized, easy to test and gate | No |
| D005 | M001 | pattern | WSL code gating | All WSL paths behind isWSL() check | No regression on native platforms | No |
