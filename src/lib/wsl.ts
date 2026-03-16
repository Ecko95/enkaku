import { execFile } from "child_process";
import { readFileSync } from "fs";
import { networkInterfaces } from "os";

// --- WSL Detection ---

let _isWSL: boolean | null = null;

/**
 * Detect if running inside WSL2 by checking /proc/version for "microsoft".
 * Result is cached after first call. Returns false on any error (non-Linux, missing file, etc).
 */
export function isWSL(): boolean {
  if (_isWSL !== null) return _isWSL;

  try {
    const version = readFileSync("/proc/version", "utf-8");
    _isWSL = /microsoft/i.test(version);
  } catch {
    _isWSL = false;
  }

  return _isWSL;
}

// --- Windows LAN IP Resolution ---

/**
 * PowerShell script to get active physical network adapter IPv4 addresses.
 * Filters out: Hyper-V virtual switches, vEthernet adapters, WSL adapters,
 * loopback, and disconnected adapters.
 */
const PS_GET_LAN_IP = `
Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {
  Get-NetIPAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -ne '127.0.0.1' }
} | Select-Object -First 1 -ExpandProperty IPAddress
`.trim();

/**
 * Resolve the Windows host's real LAN IP by calling powershell.exe from WSL.
 * Returns the first active physical adapter's IPv4 address, or null on failure.
 * Never throws.
 */
export async function getWindowsLanIp(): Promise<string | null> {
  try {
    const ip = await execPowershell(PS_GET_LAN_IP);
    if (ip && isValidIPv4(ip)) return ip;

    // Fallback: parse ipconfig output if Get-NetAdapter isn't available
    return await getWindowsLanIpFallback();
  } catch {
    return null;
  }
}

/**
 * Fallback IP resolution using ipconfig.exe — works on systems where
 * Get-NetAdapter cmdlet isn't available (e.g. Windows Home without RSAT).
 */
async function getWindowsLanIpFallback(): Promise<string | null> {
  try {
    const output = await execCommand("ipconfig.exe", []);
    if (!output) return null;

    // Parse ipconfig output for IPv4 addresses, skip loopback and WSL adapters
    const lines = output.split("\n");
    let inVirtualAdapter = false;

    for (const line of lines) {
      // Skip virtual/WSL adapter sections
      if (/vEthernet|Hyper-V|WSL/i.test(line)) {
        inVirtualAdapter = true;
        continue;
      }
      // Reset on new adapter section (lines starting without whitespace)
      if (line.match(/^\S/) && !line.startsWith(" ")) {
        inVirtualAdapter = false;
      }
      if (inVirtualAdapter) continue;

      const match = line.match(/IPv4 Address[.\s]*:\s*([\d.]+)/);
      if (match && match[1] !== "127.0.0.1" && isValidIPv4(match[1])) {
        return match[1];
      }
    }

    return null;
  } catch {
    return null;
  }
}

// --- WSL Internal IP ---

/**
 * Get the WSL2 instance's own internal IPv4 address (typically on eth0).
 * This is the address that port forwarding targets.
 * Returns null if not found. Never throws.
 */
export function getWSLInternalIp(): string | null {
  try {
    const interfaces = networkInterfaces();

    // Prefer eth0 (standard WSL2 adapter)
    const eth0 = interfaces["eth0"];
    if (eth0) {
      for (const addr of eth0) {
        if (addr.family === "IPv4" && !addr.internal) {
          return addr.address;
        }
      }
    }

    // Fallback: first non-internal IPv4 on any interface
    for (const name of Object.keys(interfaces)) {
      const addrs = interfaces[name];
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === "IPv4" && !addr.internal) {
          return addr.address;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// --- Helpers ---

export interface NetshResult {
  success: boolean;
  error?: string;
}

function isValidIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = parseInt(p, 10);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

function execPowershell(script: string): Promise<string | null> {
  return execCommand("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    script,
  ]);
}

function execCommand(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      const result = stdout.toString().trim();
      resolve(result || null);
    });
  });
}

function execNetsh(args: string[]): Promise<NetshResult> {
  return new Promise((resolve) => {
    execFile("netsh.exe", args, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        const errMsg =
          stderr?.toString().trim() ||
          stdout?.toString().trim() ||
          error.message;
        resolve({ success: false, error: errMsg });
        return;
      }
      resolve({ success: true });
    });
  });
}

// --- Port Forwarding ---

/**
 * Set up netsh portproxy to forward traffic from Windows LAN IP:port to WSL internal IP:port.
 */
export async function setupPortForward(
  port: number,
  wslIp: string,
  lanIp: string,
): Promise<NetshResult> {
  try {
    return await execNetsh([
      "interface",
      "portproxy",
      "add",
      "v4tov4",
      `listenport=${port}`,
      `listenaddress=${lanIp}`,
      `connectport=${port}`,
      `connectaddress=${wslIp}`,
    ]);
  } catch {
    return { success: false, error: "Unexpected error setting up port forward" };
  }
}

/**
 * Remove a previously created portproxy rule.
 */
export async function removePortForward(
  port: number,
  lanIp: string,
): Promise<NetshResult> {
  try {
    return await execNetsh([
      "interface",
      "portproxy",
      "delete",
      "v4tov4",
      `listenport=${port}`,
      `listenaddress=${lanIp}`,
    ]);
  } catch {
    return {
      success: false,
      error: "Unexpected error removing port forward",
    };
  }
}

/**
 * Add a Windows Firewall inbound rule to allow connections on the given port.
 */
export async function addFirewallRule(port: number): Promise<NetshResult> {
  try {
    return await execNetsh([
      "advfirewall",
      "firewall",
      "add",
      "rule",
      `name=CLR-${port}`,
      "dir=in",
      "action=allow",
      "protocol=TCP",
      `localport=${port}`,
    ]);
  } catch {
    return { success: false, error: "Unexpected error adding firewall rule" };
  }
}

/**
 * Remove the Windows Firewall inbound rule for the given port.
 */
export async function removeFirewallRule(port: number): Promise<NetshResult> {
  try {
    return await execNetsh([
      "advfirewall",
      "firewall",
      "delete",
      "rule",
      `name=CLR-${port}`,
    ]);
  } catch {
    return {
      success: false,
      error: "Unexpected error removing firewall rule",
    };
  }
}
