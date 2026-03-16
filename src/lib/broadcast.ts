export type BroadcastEvent =
  | "session_update"
  | "settings_change"
  | "new_session"
  | "session_archived"
  | "session_deleted"
  | "agent_complete"
  | "terminal_spawned"
  | "terminal_killed";

interface BroadcastMessage {
  event: BroadcastEvent;
  data?: Record<string, unknown>;
  timestamp: number;
}

type Listener = (msg: BroadcastMessage) => void;

const listeners = new Set<Listener>();

export function broadcast(event: BroadcastEvent, data?: Record<string, unknown>): void {
  const msg: BroadcastMessage = { event, data, timestamp: Date.now() };
  for (const listener of listeners) {
    try {
      listener(msg);
    } catch {
      // don't let one bad listener break others
    }
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getConnectedClientCount(): number {
  return listeners.size;
}
