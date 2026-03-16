export interface StoredSession {
  id: string;
  title: string;
  workspace: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  starred?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ToolCallInfo {
  id: string;
  callId: string;
  type: "read" | "write" | "edit" | "shell" | "search" | "todo" | "other";
  name: string;
  path?: string;
  command?: string;
  args?: string;
  status: "running" | "completed" | "error";
  result?: string;
  diff?: string;
  diffStartLine?: number;
  todos?: TodoItem[];
  timestamp: number;
}

export interface TodoItem {
  id: string;
  content: string;
  status: string;
}

export interface SessionDetail {
  sessionId: string;
  messages: ChatMessage[];
  toolCalls: ToolCallInfo[];
  modifiedAt: number;
}

export interface ChangedFile {
  path: string;
  sessionId: string;
  sessionTitle: string;
  edits: number;
  writes: number;
  diffs: string[];
}
