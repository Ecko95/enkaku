import { loadavg, totalmem, freemem, uptime as osUptime } from "os";
import { getActiveSessionIds } from "@/lib/process-registry";
import { listTerminals } from "@/lib/terminal-registry";
import { getConnectedClientCount } from "@/lib/broadcast";
import { getRecentAuditEntries } from "@/lib/audit-log";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const startTime = Date.now();

export async function GET() {
  const mem = process.memoryUsage();
  const load = loadavg();
  const total = totalmem();
  const free = freemem();

  const activeAgents = getActiveSessionIds();
  const terminals = listTerminals();
  const runningTerminals = terminals.filter((t) => t.running);
  const connectedClients = getConnectedClientCount();

  let recentAudit: Awaited<ReturnType<typeof getRecentAuditEntries>> = [];
  try {
    recentAudit = await getRecentAuditEntries(5);
  } catch {
    // audit table may not exist yet
  }

  return Response.json({
    uptime: {
      process: Math.floor((Date.now() - startTime) / 1000),
      system: Math.floor(osUptime()),
    },
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      systemTotal: total,
      systemFree: free,
    },
    cpu: {
      load1m: load[0],
      load5m: load[1],
      load15m: load[2],
    },
    agents: {
      active: activeAgents.length,
      sessionIds: activeAgents,
    },
    terminals: {
      total: terminals.length,
      running: runningTerminals.length,
    },
    clients: {
      connected: connectedClients,
    },
    workspace: getWorkspace(),
    recentAudit,
    nodeVersion: process.version,
    platform: process.platform,
  });
}
