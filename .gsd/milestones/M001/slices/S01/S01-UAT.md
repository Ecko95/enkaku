# S01: WSL Detection and LAN IP Resolution — UAT

## Prerequisites
- Running inside WSL2 on Windows
- Phone on the same Wi-Fi network as the Windows host

## Test Steps

### 1. WSL2 Detection
1. Run `clr` inside WSL2
2. **Expect:** Terminal output includes `WSL2: detected — using Windows LAN IP`

### 2. Correct IP in Output
1. Check the "Network:" line in terminal output
2. **Expect:** Shows your Windows LAN IP (e.g. `192.168.x.x`), NOT the WSL internal IP (`172.x.x.x`)

### 3. QR Code
1. Scan the QR code from your phone
2. **Expect:** URL uses the Windows LAN IP, not the WSL IP
3. **Note:** The page may not load yet if port forwarding isn't set up (that's S02)

### 4. Native Platform Regression
1. If you have a native Linux or macOS machine, run `clr` there
2. **Expect:** No WSL messages, normal LAN IP shown, behavior unchanged
