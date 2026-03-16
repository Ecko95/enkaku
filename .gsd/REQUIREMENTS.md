# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R001 — WSL2 auto-detection
- Class: core-capability
- Status: active
- Description: Automatically detect when running inside WSL2 at startup
- Why it matters: All WSL-specific behavior gates on this detection
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: none
- Validation: unmapped
- Notes: Check /proc/version for "microsoft" or "Microsoft"

### R002 — Resolve Windows LAN IP from WSL
- Class: core-capability
- Status: active
- Description: When in WSL2, resolve the Windows host's actual LAN IP (the one visible to other devices on Wi-Fi)
- Why it matters: The QR code and terminal output must show a reachable IP, not the WSL internal 172.x.x.x
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: none
- Validation: unmapped
- Notes: Use powershell.exe or ipconfig.exe from WSL to query Windows network adapters

### R003 — Automatic port forwarding via netsh portproxy
- Class: core-capability
- Status: active
- Description: Set up netsh interface portproxy rules so the WSL server port is reachable on the Windows LAN IP
- Why it matters: Without this, even with the correct IP, the port isn't reachable from the network
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: none
- Validation: unmapped
- Notes: Requires calling netsh.exe from WSL

### R004 — QR code shows correct LAN IP
- Class: primary-user-loop
- Status: active
- Description: The QR code and all terminal output show the Windows LAN IP when running in WSL2
- Why it matters: This is the primary connection method — scanning the QR from your phone
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: none
- Validation: unmapped
- Notes: Affects both bin/cursor-remote.mjs and src/lib/network.ts

### R005 — Clean up port forwarding on shutdown
- Class: core-capability
- Status: active
- Description: Remove netsh portproxy rules and firewall rules when the server exits (SIGINT, SIGTERM, or normal exit)
- Why it matters: Stale port forwarding rules accumulate and cause confusion
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: none
- Validation: unmapped
- Notes: Must handle abrupt kills gracefully — check for stale rules on startup

### R006 — Windows firewall rule for inbound access
- Class: core-capability
- Status: active
- Description: Add a Windows firewall rule to allow inbound connections on the forwarded port
- Why it matters: Windows Firewall may block inbound connections even with portproxy set up
- Source: inferred
- Primary owning slice: M001/S02
- Supporting slices: none
- Validation: unmapped
- Notes: Use netsh advfirewall firewall add rule

### R007 — No regression on native Linux/macOS
- Class: constraint
- Status: active
- Description: All WSL-specific code paths are gated behind WSL detection; behavior on native platforms is unchanged
- Why it matters: The tool must keep working on its primary platforms
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: M001/S02, M001/S03
- Validation: unmapped
- Notes: Every WSL code path must check isWSL before executing

### R008 — Graceful fallback when netsh lacks admin privileges
- Class: failure-visibility
- Status: active
- Description: When port forwarding fails due to insufficient privileges, show clear instructions instead of crashing
- Why it matters: User may not be running with admin privileges; they need to know what to do
- Source: research
- Primary owning slice: M001/S03
- Supporting slices: none
- Validation: unmapped
- Notes: Show the manual netsh commands the user can run in an elevated prompt

## Deferred

### R009 — WSL mirrored networking mode support
- Class: core-capability
- Status: deferred
- Description: Detect and leverage WSL2 mirrored networking mode where ports are automatically shared
- Why it matters: Users with mirrored networking don't need portproxy; detecting this avoids unnecessary setup
- Source: research
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: Deferred — mirrored networking is newer and less common; portproxy works universally

## Out of Scope

### R010 — Bridged/static IP WSL networking
- Class: constraint
- Status: out-of-scope
- Description: Support for WSL2 bridged networking or static IP configurations
- Why it matters: Prevents scope creep into niche networking setups
- Source: research
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: Users with custom WSL networking can configure it themselves

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | core-capability | active | M001/S01 | none | unmapped |
| R002 | core-capability | active | M001/S01 | none | unmapped |
| R003 | core-capability | active | M001/S02 | none | unmapped |
| R004 | primary-user-loop | active | M001/S01 | none | unmapped |
| R005 | core-capability | active | M001/S02 | none | unmapped |
| R006 | core-capability | active | M001/S02 | none | unmapped |
| R007 | constraint | active | M001/S01 | M001/S02, M001/S03 | unmapped |
| R008 | failure-visibility | active | M001/S03 | none | unmapped |
| R009 | core-capability | deferred | none | none | unmapped |
| R010 | constraint | out-of-scope | none | none | n/a |

## Coverage Summary

- Active requirements: 8
- Mapped to slices: 8
- Validated: 0
- Unmapped active requirements: 0
