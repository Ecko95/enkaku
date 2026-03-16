import { getDb } from "@/lib/session-store";

export type AuditEvent =
  | "auth_success"
  | "auth_failure"
  | "chat_sent"
  | "terminal_command"
  | "git_action"
  | "session_kill"
  | "settings_change"
  | "file_access";

export interface AuditEntry {
  id: number;
  timestamp: number;
  ip: string;
  event: AuditEvent;
  detail: string;
  sessionId: string | null;
}

const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      ip TEXT NOT NULL DEFAULT '',
      event TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      session_id TEXT
    )
  `);
  try {
    db.run("CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(timestamp)");
  } catch {
    // index already exists
  }
  tableReady = true;
}

export async function logAudit(
  event: AuditEvent,
  detail: string,
  ip = "",
  sessionId: string | null = null,
): Promise<void> {
  try {
    await ensureTable();
    const db = await getDb();
    db.run(
      "INSERT INTO audit_log (timestamp, ip, event, detail, session_id) VALUES (?, ?, ?, ?, ?)",
      [Date.now(), ip, event, detail.slice(0, 500), sessionId],
    );
  } catch {
    // fire-and-forget
  }
}

export async function queryAuditLog(options: {
  limit?: number;
  offset?: number;
  event?: AuditEvent;
  since?: number;
}): Promise<{ entries: AuditEntry[]; total: number }> {
  await ensureTable();
  const db = await getDb();
  const limit = Math.min(options.limit ?? 50, 200);
  const offset = options.offset ?? 0;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.event) {
    conditions.push("event = ?");
    params.push(options.event);
  }
  if (options.since) {
    conditions.push("timestamp >= ?");
    params.push(options.since);
  }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  const countStmt = db.prepare(`SELECT COUNT(*) as cnt FROM audit_log ${where}`);
  countStmt.bind(params);
  let total = 0;
  if (countStmt.step()) {
    total = (countStmt.getAsObject() as { cnt: number }).cnt;
  }
  countStmt.free();

  const queryParams = [...params, limit, offset];
  const stmt = db.prepare(
    `SELECT id, timestamp, ip, event, detail, session_id FROM audit_log ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
  );
  stmt.bind(queryParams);
  const entries: AuditEntry[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    entries.push({
      id: row.id as number,
      timestamp: row.timestamp as number,
      ip: row.ip as string,
      event: row.event as AuditEvent,
      detail: row.detail as string,
      sessionId: (row.session_id as string) || null,
    });
  }
  stmt.free();

  return { entries, total };
}

export async function pruneAuditLog(): Promise<number> {
  await ensureTable();
  const db = await getDb();
  const cutoff = Date.now() - PRUNE_AFTER_MS;
  db.run("DELETE FROM audit_log WHERE timestamp < ?", [cutoff]);
  const result = db.exec("SELECT changes() as cnt");
  return result[0]?.values[0]?.[0] as number ?? 0;
}

export async function getRecentAuditEntries(count = 5): Promise<AuditEntry[]> {
  const { entries } = await queryAuditLog({ limit: count });
  return entries;
}
