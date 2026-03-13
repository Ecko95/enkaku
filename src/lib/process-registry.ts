import type { ChildProcess } from "child_process";

interface RunningProcess {
  child: ChildProcess;
  sessionId: string | null;
  workspace: string;
  startedAt: number;
}

const processes = new Map<string, RunningProcess>();

export function registerProcess(
  requestId: string,
  child: ChildProcess,
  workspace: string,
): void {
  const entry: RunningProcess = {
    child,
    sessionId: null,
    workspace,
    startedAt: Date.now(),
  };
  processes.set(requestId, entry);

  const onExit = () => {
    processes.delete(requestId);
    if (entry.sessionId && entry.sessionId !== requestId) {
      processes.delete(entry.sessionId);
    }
  };
  child.on("close", onExit);
  child.on("error", onExit);
}

export function promoteToSessionId(requestId: string, sessionId: string): void {
  const entry = processes.get(requestId);
  if (!entry) return;
  entry.sessionId = sessionId;
  if (sessionId !== requestId) {
    processes.set(sessionId, entry);
    processes.delete(requestId);
  }
}

export function getActiveSessionIds(): string[] {
  const ids: string[] = [];
  for (const [key, entry] of processes) {
    const id = entry.sessionId ?? key;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function isActive(sessionId: string): boolean {
  return processes.has(sessionId);
}

export function killProcess(sessionId: string): boolean {
  const entry = processes.get(sessionId);
  if (!entry) return false;
  entry.child.kill("SIGTERM");
  return true;
}
