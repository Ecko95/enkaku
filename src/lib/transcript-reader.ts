import { readdirSync, statSync, readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import type { StoredSession, ChatMessage, ToolCallInfo, TodoItem } from "@/lib/types";

const CURSOR_PROJECTS_DIR = join(homedir(), ".cursor", "projects");

export function workspaceToProjectKey(workspace: string): string {
  const abs = resolve(workspace);
  return abs.replace(/^\//, "").replace(/\//g, "-");
}

function findTranscriptsDir(workspace: string): string | null {
  const key = workspaceToProjectKey(workspace);
  const dir = join(CURSOR_PROJECTS_DIR, key, "agent-transcripts");
  return existsSync(dir) ? dir : null;
}

function parseJsonlEntries(jsonlPath: string): Record<string, unknown>[] {
  try {
    const content = readFileSync(jsonlPath, "utf-8");
    const entries: Record<string, unknown>[] = [];
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line));
      } catch {
        continue;
      }
    }
    return entries;
  } catch {
    return [];
  }
}

function extractFirstUserMessage(jsonlPath: string): string {
  for (const entry of parseJsonlEntries(jsonlPath)) {
    if (entry.role === "user") {
      const msg = entry.message as Record<string, unknown> | undefined;
      const content = msg?.content as Array<Record<string, unknown>> | undefined;
      const text: string = (content?.[0]?.text as string) || "";
      return text
        .replace(/<[^>]+>/g, "")
        .trim()
        .slice(0, 120);
    }
  }
  return "";
}

function findJsonlFile(entryPath: string, entryName: string): string | null {
  const stat = statSync(entryPath);

  if (stat.isFile() && entryName.endsWith(".jsonl")) {
    return entryPath;
  }

  if (stat.isDirectory()) {
    const inner = join(entryPath, entryName + ".jsonl");
    if (existsSync(inner)) return inner;

    try {
      const files = readdirSync(entryPath).filter((f) => f.endsWith(".jsonl"));
      if (files.length > 0) return join(entryPath, files[0]);
    } catch {
      // read error
    }
  }

  return null;
}

export function readCursorSessions(workspace: string): StoredSession[] {
  const dir = findTranscriptsDir(workspace);
  if (!dir) return [];

  const sessions: StoredSession[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const entryPath = join(dir, entry);
      const jsonl = findJsonlFile(entryPath, entry.replace(".jsonl", ""));
      if (!jsonl) continue;

      const stat = statSync(jsonl);
      const sessionId = entry.replace(".jsonl", "");
      const preview = extractFirstUserMessage(jsonl);

      if (!preview) continue;

      sessions.push({
        id: sessionId,
        title: preview.slice(0, 60),
        workspace,
        preview,
        createdAt: stat.birthtimeMs,
        updatedAt: stat.mtimeMs,
      });
    }
  } catch {
    // directory read error
  }

  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

function stripXmlTags(text: string): string {
  return text
    .replace(/<user_query>\n?/g, "")
    .replace(/<\/user_query>\n?/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export interface SessionHistoryResult {
  messages: ChatMessage[];
  toolCalls: ToolCallInfo[];
  modifiedAt: number;
}

export function resolveJsonlPath(workspace: string, sessionId: string): string | null {
  const dir = findTranscriptsDir(workspace);
  if (!dir) return null;

  const resolvedDir = resolve(dir);
  const entryPath = resolve(dir, sessionId);
  if (!entryPath.startsWith(resolvedDir + "/")) return null;

  const flatPath = join(dir, sessionId + ".jsonl");

  if (existsSync(entryPath) && statSync(entryPath).isDirectory()) {
    return findJsonlFile(entryPath, sessionId);
  }
  if (existsSync(flatPath)) {
    return flatPath;
  }
  return null;
}

export function getSessionModifiedAt(workspace: string, sessionId: string): number {
  const jsonlPath = resolveJsonlPath(workspace, sessionId);
  if (!jsonlPath) return 0;
  try {
    return statSync(jsonlPath).mtimeMs;
  } catch {
    return 0;
  }
}

const TOOL_NAME_MAP: Record<string, ToolCallInfo["type"]> = {
  Read: "read",
  Write: "write",
  Edit: "edit",
  StrReplace: "edit",
  Shell: "shell",
  Grep: "search",
  Glob: "search",
  List: "read",
  TodoWrite: "todo",
};

function extractToolCallsFromContent(
  contentArr: unknown[],
  sessionId: string,
  counter: { n: number },
  baseTimestamp: number,
): ToolCallInfo[] {
  const calls: ToolCallInfo[] = [];
  for (const part of contentArr) {
    if (typeof part !== "object" || part === null) continue;
    const p = part as Record<string, unknown>;
    if (p.type !== "tool_use") continue;

    const name = (p.name as string) || "Tool";
    const input = (p.input as Record<string, unknown>) || {};
    const type = TOOL_NAME_MAP[name] || "other";

    let todos: TodoItem[] | undefined;
    if (name === "TodoWrite" && Array.isArray(input.todos)) {
      todos = (input.todos as Record<string, string>[]).map((t) => ({
        id: t.id,
        content: t.content,
        status: t.status?.toUpperCase().includes("COMPLETED")
          ? "TODO_STATUS_COMPLETED"
          : t.status?.toUpperCase().includes("PROGRESS")
            ? "TODO_STATUS_IN_PROGRESS"
            : "TODO_STATUS_PENDING",
      }));
    }

    const done = todos?.filter((t) => t.status.includes("COMPLETED")).length ?? 0;
    const total = todos?.length ?? 0;

    calls.push({
      id: `${sessionId}-tc-${counter.n++}`,
      callId: `${sessionId}-tc-${counter.n}`,
      type,
      name,
      path: (input.path || input.file_path) as string | undefined,
      command:
        type === "shell"
          ? (input.command as string)
          : type === "search"
            ? (input.pattern as string)
            : undefined,
      status: "completed",
      result: type === "todo" && total > 0 ? `${total} items · ${done} done` : undefined,
      todos,
      timestamp: baseTimestamp + counter.n,
    });
  }
  return calls;
}

export function readSessionMessages(workspace: string, sessionId: string): SessionHistoryResult {
  const jsonlPath = resolveJsonlPath(workspace, sessionId);
  if (!jsonlPath) return { messages: [], toolCalls: [], modifiedAt: 0 };

  let modifiedAt = 0;
  try {
    modifiedAt = statSync(jsonlPath).mtimeMs;
  } catch {
    return { messages: [], toolCalls: [], modifiedAt: 0 };
  }

  const messages: ChatMessage[] = [];
  const toolCalls: ToolCallInfo[] = [];
  const counter = { n: 0 };
  const baseTimestamp = modifiedAt - 60_000;

  for (const entry of parseJsonlEntries(jsonlPath)) {
    const role = entry.role as string;
    if (role !== "user" && role !== "assistant") continue;

    const contentArr = (entry.message as Record<string, unknown> | undefined)?.content;
    if (!Array.isArray(contentArr)) continue;

    const textParts: string[] = [];
    for (const part of contentArr) {
      if (part.type === "text" && part.text) {
        textParts.push(part.text);
      }
    }

    let text = textParts.join("");
    if (role === "user") {
      text = stripXmlTags(text);
    }

    if (text.trim()) {
      messages.push({
        id: `${sessionId}-${counter.n++}`,
        role: role as "user" | "assistant",
        content: text,
        timestamp: baseTimestamp + counter.n,
      });
    }

    if (role === "assistant") {
      toolCalls.push(...extractToolCallsFromContent(contentArr, sessionId, counter, baseTimestamp));
    }
  }

  return { messages, toolCalls, modifiedAt };
}
