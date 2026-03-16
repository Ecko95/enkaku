import { openDB, type IDBPDatabase } from "idb";
import type { StoredSession, ChatMessage, ToolCallInfo } from "@/lib/types";

const DB_NAME = "clr-offline";
const DB_VERSION = 1;

interface CLROfflineDB {
  sessions: {
    key: string;
    value: StoredSession;
    indexes: { "by-workspace": string; "by-updated": number };
  };
  messages: {
    key: string;
    value: { sessionId: string; messages: ChatMessage[]; toolCalls: ToolCallInfo[]; cachedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<CLROfflineDB>> | null = null;

function getDb() {
  if (typeof window === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB<CLROfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("sessions")) {
          const store = db.createObjectStore("sessions", { keyPath: "id" });
          store.createIndex("by-workspace", "workspace");
          store.createIndex("by-updated", "updatedAt");
        }
        if (!db.objectStoreNames.contains("messages")) {
          db.createObjectStore("messages", { keyPath: "sessionId" });
        }
      },
    });
  }
  return dbPromise;
}

export async function cacheSessions(sessions: StoredSession[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const tx = db.transaction("sessions", "readwrite");
  for (const session of sessions) {
    await tx.store.put(session);
  }
  await tx.done;
}

export async function getCachedSessions(workspace?: string): Promise<StoredSession[]> {
  const db = await getDb();
  if (!db) return [];
  if (workspace) {
    return db.getAllFromIndex("sessions", "by-workspace", workspace);
  }
  const all = await db.getAll("sessions");
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function cacheMessages(
  sessionId: string,
  messages: ChatMessage[],
  toolCalls: ToolCallInfo[],
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.put("messages", { sessionId, messages, toolCalls, cachedAt: Date.now() });
}

export async function getCachedMessages(
  sessionId: string,
): Promise<{ messages: ChatMessage[]; toolCalls: ToolCallInfo[] } | null> {
  const db = await getDb();
  if (!db) return null;
  const entry = await db.get("messages", sessionId);
  if (!entry) return null;
  return { messages: entry.messages, toolCalls: entry.toolCalls };
}

export async function clearCache(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const tx = db.transaction(["sessions", "messages"], "readwrite");
  await tx.objectStore("sessions").clear();
  await tx.objectStore("messages").clear();
  await tx.done;
}
