import { networkInterfaces } from "os";
import { isWSL, getWindowsLanIp } from "./wsl";

export async function getLanIp(): Promise<string | null> {
  // In WSL2, resolve the Windows host's LAN IP instead of the WSL internal IP
  if (isWSL()) {
    const windowsIp = await getWindowsLanIp();
    if (windowsIp) return windowsIp;
    // Fall through to native resolution if Windows IP unavailable
  }

  const interfaces = networkInterfaces();

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
}

export async function getNetworkInfo(port: number = 3100) {
  const lanIp = await getLanIp();
  return {
    lanIp: lanIp || "localhost",
    port,
    url: lanIp ? `http://${lanIp}:${port}` : `http://localhost:${port}`,
  };
}
