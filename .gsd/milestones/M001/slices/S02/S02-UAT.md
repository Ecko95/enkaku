# S02: Automatic Port Forwarding and Cleanup — UAT

## Prerequisites
- Running inside WSL2 on Windows
- Phone on the same Wi-Fi network

## Test Steps

### 1. Port Forwarding Setup
1. Run `clr` inside WSL2
2. **Expect:** See "⚡ Setting up port forwarding..." followed by "✓ Port forwarded: 192.168.x.x:3100 → 172.x.x.x:3100"
3. Verify: run `netsh.exe interface portproxy show v4tov4` — should show the rule

### 2. Phone Connectivity
1. Scan the QR code from your phone
2. **Expect:** The Cursor remote UI loads and is functional

### 3. Cleanup on Exit
1. Press Ctrl+C to stop `clr`
2. Run `netsh.exe interface portproxy show v4tov4`
3. **Expect:** The rule for your port is gone

### 4. --no-forward Flag
1. Run `clr --no-forward`
2. **Expect:** No port forwarding messages, server starts normally

### 5. Privilege Error (if applicable)
1. If your WSL session doesn't have admin access, forwarding may fail
2. **Expect:** Clear error message with manual netsh commands to copy-paste into elevated PowerShell
