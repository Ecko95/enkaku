import initSqlJs from "sql.js";
import { join } from "path";
import { homedir } from "os";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import type { StoredSession } from "@/lib/types";

const DATA_DIR = join(homedir(), ".cursor-local-remote");
const DB_PATH = join(DATA_DIR, "sessions.db");

type Database = initSqlJs.Database;

let db: Database | null = null;
let sqlReady: Promise<initSqlJs.SqlJsStatic> | null = null;

function getSql() {
  if (!sqlReady) sqlReady = initSqlJs();
  return sqlReady;
}

function save() {
  if (!db) return;
  writeFileSync(DB_PATH, Buffer.from(db.export()));
}

export async function getDb(): Promise<Database> {
  if (db) return db;

  const { Database: SqlDatabase } = await getSql();
  mkdirSync(DATA_DIR, { recursive: true });

  if (existsSync(DB_PATH)) {
    const buf = readFileSync(DB_PATH);
    db = new SqlDatabase(buf);
  } else {
    db = new SqlDatabase();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      workspace TEXT NOT NULL,
      preview TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      subscription TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  save();
  return db;
}

type SqlValue = initSqlJs.SqlValue;

function queryOne(conn: Database, sql: string, params: SqlValue[]): Record<string, SqlValue> | undefined {
  const stmt = conn.prepare(sql);
  try {
    stmt.bind(params);
    if (stmt.step()) return stmt.getAsObject() as Record<string, SqlValue>;
    return undefined;
  } finally {
    stmt.free();
  }
}

function queryAll(conn: Database, sql: string, params: SqlValue[] = []): Record<string, SqlValue>[] {
  const stmt = conn.prepare(sql);
  try {
    stmt.bind(params);
    const rows: Record<string, SqlValue>[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as Record<string, SqlValue>);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

function rowToSession(row: Record<string, SqlValue>): StoredSession {
  return {
    id: row.id as string,
    title: row.title as string,
    workspace: row.workspace as string,
    preview: row.preview as string,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export async function upsertSession(
  sessionId: string,
  workspace: string,
  firstMessage: string,
): Promise<StoredSession> {
  const conn = await getDb();
  const now = Date.now();
  const existing = queryOne(conn, "SELECT * FROM sessions WHERE id = ?", [sessionId]);

  if (existing) {
    const preview = firstMessage ? firstMessage.slice(0, 120) : (existing.preview as string);
    conn.run("UPDATE sessions SET updated_at = ?, preview = ? WHERE id = ?", [now, preview, sessionId]);
    save();
    return rowToSession({ ...existing, updated_at: now, preview });
  }

  const title = firstMessage.slice(0, 60) || "New session";
  const preview = firstMessage.slice(0, 120);
  conn.run(
    "INSERT INTO sessions (id, title, workspace, preview, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [sessionId, title, workspace, preview, now, now],
  );
  save();
  return { id: sessionId, title, workspace, preview, createdAt: now, updatedAt: now };
}

export async function listSessions(workspace?: string): Promise<StoredSession[]> {
  const conn = await getDb();
  const rows = workspace
    ? queryAll(conn, "SELECT * FROM sessions WHERE workspace = ? ORDER BY updated_at DESC", [workspace])
    : queryAll(conn, "SELECT * FROM sessions ORDER BY updated_at DESC");
  return rows.map(rowToSession);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const conn = await getDb();
  conn.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
  save();
}
