import webpush from "web-push";
import type initSqlJs from "sql.js";
import { getDb } from "@/lib/session-store";

type Database = initSqlJs.Database;

interface StoredVapidKeys {
  publicKey: string;
  privateKey: string;
}

function queryValue(conn: Database, sql: string, params: initSqlJs.BindParams): string | undefined {
  const stmt = conn.prepare(sql);
  try {
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, initSqlJs.SqlValue>;
      return row.value as string | undefined;
    }
    return undefined;
  } finally {
    stmt.free();
  }
}

async function loadOrCreateVapidKeys(): Promise<StoredVapidKeys> {
  const conn = await getDb();

  const value = queryValue(conn, "SELECT value FROM config WHERE key = ?", ["vapid_keys"]);

  if (value) {
    return JSON.parse(value) as StoredVapidKeys;
  }

  const keys = webpush.generateVAPIDKeys();
  const stored: StoredVapidKeys = {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
  };

  conn.run("INSERT INTO config (key, value) VALUES (?, ?)", ["vapid_keys", JSON.stringify(stored)]);
  return stored;
}

let initialized = false;

async function ensureVapid(): Promise<StoredVapidKeys> {
  const keys = await loadOrCreateVapidKeys();

  if (!initialized) {
    webpush.setVapidDetails("mailto:clr@localhost", keys.publicKey, keys.privateKey);
    initialized = true;
  }

  return keys;
}

export async function getVapidPublicKey(): Promise<string> {
  return (await ensureVapid()).publicKey;
}

export async function savePushSubscription(subscription: webpush.PushSubscription): Promise<void> {
  const conn = await getDb();
  conn.run(
    "INSERT OR REPLACE INTO push_subscriptions (endpoint, subscription, created_at) VALUES (?, ?, ?)",
    [subscription.endpoint, JSON.stringify(subscription), Date.now()],
  );
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const conn = await getDb();
  conn.run("DELETE FROM push_subscriptions WHERE endpoint = ?", [endpoint]);
}

async function getAllSubscriptions(): Promise<{ endpoint: string; subscription: webpush.PushSubscription }[]> {
  const conn = await getDb();
  const stmt = conn.prepare("SELECT endpoint, subscription FROM push_subscriptions");
  try {
    const rows: { endpoint: string; subscription: webpush.PushSubscription }[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as { endpoint: string; subscription: string };
      rows.push({
        endpoint: row.endpoint,
        subscription: JSON.parse(row.subscription) as webpush.PushSubscription,
      });
    }
    return rows;
  } finally {
    stmt.free();
  }
}

export async function notifyAllSubscribers(title: string, body: string): Promise<void> {
  await ensureVapid();
  const subs = await getAllSubscriptions();
  if (subs.length === 0) return;

  const payload = JSON.stringify({ title, body });

  await Promise.allSettled(
    subs.map(async ({ endpoint, subscription }) => {
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await removePushSubscription(endpoint);
        } else {
          console.error("[push] Failed to send to " + endpoint.slice(0, 60) + ":", err);
        }
      }
    }),
  );
}
