export interface SystemInitEvent {
  type: "system";
  subtype: "init";
  apiKeySource: string;
  cwd: string;
  session_id: string;
  model: string;
  permissionMode: string;
}

export interface UserMessageEvent {
  type: "user";
  message: {
    role: "user";
    content: Array<{ type: "text"; text: string }>;
  };
  session_id: string;
}

export interface AssistantMessageEvent {
  type: "assistant";
  message: {
    role: "assistant";
    content: Array<{ type: "text"; text: string }>;
  };
  session_id: string;
}

export interface ToolCallStartedEvent {
  type: "tool_call";
  subtype: "started";
  call_id: string;
  tool_call: Record<string, unknown>;
  session_id: string;
}

export interface ToolCallCompletedEvent {
  type: "tool_call";
  subtype: "completed";
  call_id: string;
  tool_call: Record<string, unknown>;
  session_id: string;
}

export type ToolCallEvent = ToolCallStartedEvent | ToolCallCompletedEvent;

export interface ResultEvent {
  type: "result";
  subtype: "success" | "error";
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  result: string;
  session_id: string;
  request_id?: string;
}

export type StreamEvent =
  | SystemInitEvent
  | UserMessageEvent
  | AssistantMessageEvent
  | ToolCallEvent
  | ResultEvent;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface TodoItem {
  id: string;
  content: string;
  status: string;
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

export interface StoredSession {
  id: string;
  title: string;
  workspace: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
}

export type AgentMode = "agent" | "ask" | "plan";

export interface ChatRequest {
  prompt: string;
  sessionId?: string;
  model?: string;
  mode?: AgentMode;
}

export interface NetworkInfo {
  lanIp: string;
  port: number;
  url: string;
  authUrl: string;
  workspace: string;
}

export interface QueuedMessage {
  id: string;
  content: string;
  timestamp: number;
  model?: string;
  mode?: AgentMode;
}

export interface ModelInfo {
  id: string;
  label: string;
  isDefault: boolean;
  isCurrent: boolean;
}
