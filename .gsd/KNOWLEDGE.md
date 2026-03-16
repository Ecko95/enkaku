# Knowledge Register

<!-- Append-only. Read at the start of every unit. Append when you discover
     a recurring issue, a non-obvious pattern, or a rule that future agents should follow. -->

| # | Scope | Rule / Pattern | Why |
|---|-------|----------------|-----|
| K001 | codebase | getLanIp() exists in TWO places: bin/cursor-remote.mjs (JS) and src/lib/network.ts (TS) | Both must be updated for any networking changes; the bin file is the CLI entrypoint, network.ts is used by API routes |
| K002 | codebase | shutdown handling exists in TWO places: bin/cursor-remote.mjs (process signals) and src/lib/shutdown.ts (Next.js instrumentation) | Port forwarding cleanup must hook into the bin file's shutdown, not the Next.js one |
