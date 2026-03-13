import { readFile, writeFile, mkdir, access } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import type { StoredSession } from "@/lib/types";

interface StoreData {
  sessions: StoredSession[];
}

const DATA_DIR = join(homedir(), ".cursor-local-remote");
const STORE_PATH = join(DATA_DIR, "sessions.json");

async function ensureDir() {
  try {
    await access(DATA_DIR);
  } catch {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function readStore(): Promise<StoreData> {
  await ensureDir();
  try {
    const content = await readFile(STORE_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return { sessions: [] };
  }
}

async function writeStore(data: StoreData) {
  await ensureDir();
  await writeFile(STORE_PATH, JSON.stringify(data, null, 2));
}

export async function upsertSession(
  sessionId: string,
  workspace: string,
  firstMessage: string,
): Promise<StoredSession> {
  const store = await readStore();
  const existing = store.sessions.find((s) => s.id === sessionId);

  if (existing) {
    existing.updatedAt = Date.now();
    if (firstMessage) existing.preview = firstMessage.slice(0, 120);
    await writeStore(store);
    return existing;
  }

  const title = firstMessage.slice(0, 60) || "New session";
  const session: StoredSession = {
    id: sessionId,
    title,
    workspace,
    preview: firstMessage.slice(0, 120),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  store.sessions.unshift(session);
  await writeStore(store);
  return session;
}

export async function listSessions(workspace?: string): Promise<StoredSession[]> {
  const store = await readStore();
  const sessions = workspace
    ? store.sessions.filter((s) => s.workspace === workspace)
    : store.sessions;
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteSession(sessionId: string) {
  const store = await readStore();
  store.sessions = store.sessions.filter((s) => s.id !== sessionId);
  await writeStore(store);
}
