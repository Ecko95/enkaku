"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  ChatMessage,
  ToolCallInfo,
  TodoItem,
  StreamEvent,
  ChatRequest,
  AgentMode,
  QueuedMessage,
} from "@/lib/types";
import { apiFetch } from "@/lib/api-fetch";

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  (typeof crypto !== "undefined" ? crypto : globalThis.crypto).getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface UseChatReturn {
  messages: ChatMessage[];
  toolCalls: ToolCallInfo[];
  sessionId: string | null;
  isStreaming: boolean;
  isLoadingHistory: boolean;
  isWatching: boolean;
  model: string | null;
  selectedModel: string;
  selectedMode: AgentMode;
  error: string | null;
  queuedMessages: QueuedMessage[];
  sendMessage: (prompt: string, overrides?: { model?: string; mode?: AgentMode }) => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  setSessionId: (id: string | null) => void;
  setSelectedModel: (model: string) => void;
  setSelectedMode: (mode: AgentMode) => void;
  clearChat: () => void;
  stopStreaming: () => void;
  retryLastMessage: () => void;
  forceSendQueued: (id: string) => void;
  editQueued: (id: string, newContent: string) => void;
  deleteQueued: (id: string) => void;
}

async function fetchActiveSessions(): Promise<string[]> {
  try {
    const res = await apiFetch("/api/sessions/active");
    if (!res.ok) return [];
    const data = await res.json();
    return data.sessions || [];
  } catch {
    return [];
  }
}

export { fetchActiveSessions };

function extractAssistantText(message: Record<string, unknown>): string {
  const content = message.content;

  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((c: Record<string, unknown>) => {
        if (typeof c === "string") return c;
        if (c && typeof c.text === "string") return c.text;
        return "";
      })
      .join("");
  }

  return String(content ?? "");
}

function parseJsonSafe(str: string): Record<string, unknown> | null {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

type ToolExtractor = (
  toolCall: Record<string, unknown>,
  status: "running" | "completed",
) => Partial<ToolCallInfo> | null;

function findDiffStartLine(diffStr: string, beforeContent: string): number | undefined {
  const firstContext = diffStr
    .split("\n")
    .find((l) => l.length > 0 && !l.startsWith("+") && !l.startsWith("-"));
  if (!firstContext) return undefined;
  const search = firstContext.startsWith(" ") ? firstContext.slice(1) : firstContext;
  const idx = beforeContent.split("\n").indexOf(search);
  return idx >= 0 ? idx + 1 : undefined;
}

function extractEditCall(
  tc: Record<string, unknown>,
  status: "running" | "completed",
): Partial<ToolCallInfo> {
  const args = tc.args as Record<string, string>;
  const success = (tc.result as Record<string, Record<string, unknown>> | undefined)?.success;
  let diffStartLine: number | undefined;
  const diffStr = success?.diffString ? String(success.diffString) : undefined;
  if (diffStr && success?.beforeFullFileContent) {
    diffStartLine = findDiffStartLine(diffStr, String(success.beforeFullFileContent));
  }
  return {
    type: "edit",
    name: "Edit",
    path: args?.path,
    status,
    diff: status === "completed" ? diffStr : undefined,
    diffStartLine,
    result:
      status === "completed" && success
        ? `+${success.linesAdded ?? 0} -${success.linesRemoved ?? 0}`
        : undefined,
  };
}

const TOOL_EXTRACTORS: Record<string, ToolExtractor> = {
  readToolCall: (toolCall, status) => {
    const tc = toolCall.readToolCall as Record<string, unknown>;
    const args = tc.args as Record<string, string>;
    const result = tc.result as Record<string, Record<string, unknown>> | undefined;
    return {
      type: "read",
      name: "Read",
      path: args.path,
      status,
      result:
        status === "completed" && result?.success
          ? `${result.success.totalLines} lines`
          : undefined,
    };
  },
  writeToolCall: (toolCall, status) => {
    const tc = toolCall.writeToolCall as Record<string, unknown>;
    const args = tc.args as Record<string, string>;
    const result = tc.result as Record<string, Record<string, unknown>> | undefined;
    return {
      type: "write",
      name: "Write",
      path: args.path,
      status,
      result:
        status === "completed" && result?.success
          ? `${result.success.linesCreated} lines`
          : undefined,
    };
  },
  shellToolCall: (toolCall, status) => {
    const tc = toolCall.shellToolCall as Record<string, unknown>;
    const args = tc.args as Record<string, string>;
    return { type: "shell", name: "Shell", command: args?.command, status };
  },
  strReplaceToolCall: (toolCall, status) =>
    extractEditCall(toolCall.strReplaceToolCall as Record<string, unknown>, status),
  editToolCall: (toolCall, status) =>
    extractEditCall(toolCall.editToolCall as Record<string, unknown>, status),
  grepToolCall: (toolCall, status) => {
    const tc = toolCall.grepToolCall as Record<string, unknown>;
    const args = tc.args as Record<string, string>;
    return { type: "search", name: "Grep", path: args?.path, command: args?.pattern, status };
  },
  globToolCall: (toolCall, status) => {
    const tc = toolCall.globToolCall as Record<string, unknown>;
    const args = tc.args as Record<string, string>;
    return {
      type: "search",
      name: "Glob",
      command: args?.globPattern || args?.glob_pattern,
      status,
    };
  },
  listToolCall: (toolCall, status) => {
    const tc = toolCall.listToolCall as Record<string, unknown>;
    const args = tc.args as Record<string, string>;
    return { type: "read", name: "List", path: args?.path, status };
  },
  updateTodosToolCall: (toolCall, status) => {
    const tc = toolCall.updateTodosToolCall as Record<string, unknown>;
    const raw = (tc.result as Record<string, unknown>)?.success as
      | Record<string, unknown>
      | undefined;
    const source = raw?.todos ?? (tc.args as Record<string, unknown>)?.todos;
    const items = Array.isArray(source)
      ? (source as Record<string, string>[]).map(
          (t): TodoItem => ({
            id: t.id,
            content: t.content,
            status: t.status,
          }),
        )
      : undefined;
    const done = items?.filter((t) => t.status.includes("COMPLETED")).length ?? 0;
    const total = items?.length ?? 0;
    return {
      type: "todo" as const,
      name: "Todo",
      status,
      todos: items,
      result: total > 0 ? `${total} items · ${done} done` : undefined,
    };
  },
};

const FN_NAME_MATCHERS: Array<{
  test: (n: string) => boolean;
  extract: (fnName: string, fnArgs: Record<string, unknown> | null) => Partial<ToolCallInfo>;
}> = [
  {
    test: (n) => n.includes("bash") || n.includes("shell") || n.includes("execute"),
    extract: (_n, a) => ({
      type: "shell",
      name: "Shell",
      command: a?.command as string | undefined,
    }),
  },
  {
    test: (n) => n.includes("edit") || n.includes("replace"),
    extract: (_n, a) => ({
      type: "edit",
      name: "Edit",
      path: (a?.path || a?.file_path) as string | undefined,
    }),
  },
  {
    test: (n) => n.includes("grep") || n.includes("search") || n.includes("glob"),
    extract: (n, a) => ({
      type: "search",
      name: n,
      command: (a?.pattern || a?.query) as string | undefined,
    }),
  },
  {
    test: (n) => n.includes("read"),
    extract: (_n, a) => ({
      type: "read",
      name: "Read",
      path: (a?.path || a?.file_path) as string | undefined,
    }),
  },
  {
    test: (n) => n.includes("write") || n.includes("create"),
    extract: (_n, a) => ({
      type: "write",
      name: "Write",
      path: (a?.path || a?.file_path) as string | undefined,
    }),
  },
];

function extractToolCallInfo(
  toolCall: Record<string, unknown>,
  callId: string,
  status: "running" | "completed",
): Partial<ToolCallInfo> {
  for (const key of Object.keys(toolCall)) {
    const extractor = TOOL_EXTRACTORS[key];
    if (extractor) {
      const result = extractor(toolCall, status);
      if (result) return result;
    }
  }

  if ("function" in toolCall) {
    const fn = toolCall.function as Record<string, string>;
    const fnName = fn.name || "Tool";
    const fnArgs = fn.arguments ? parseJsonSafe(fn.arguments) : null;
    const nameLower = fnName.toLowerCase();
    const match = FN_NAME_MATCHERS.find((m) => m.test(nameLower));
    if (match) return { ...match.extract(fnName, fnArgs), status };
    return { type: "other", name: fnName, args: fn.arguments, status };
  }

  const keys = Object.keys(toolCall).filter((k) => k !== "result");
  const toolKey = keys.find((k) => k.endsWith("ToolCall") || k.endsWith("Call"));
  if (toolKey) {
    const readable = toolKey
      .replace(/ToolCall$/, "")
      .replace(/Call$/, "")
      .replace(/([a-z])([A-Z])/g, "$1 $2");
    const name = readable.charAt(0).toUpperCase() + readable.slice(1);
    const tc = toolCall[toolKey] as Record<string, unknown>;
    const args = tc?.args as Record<string, string> | undefined;
    return { type: "other", name, path: args?.path || args?.file_path, status };
  }

  return { type: "other", name: "Tool", status };
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallInfo[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [model, setModel] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("auto");
  const [selectedMode, setSelectedMode] = useState<AgentMode>("agent");
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const queueRef = useRef<QueuedMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastModifiedRef = useRef<number>(0);
  const sessionIdRef = useRef<string | null>(null);
  const sendMessageRef = useRef<
    ((prompt: string, overrides?: { model?: string; mode?: AgentMode }) => Promise<void>) | undefined
  >(undefined);

  useEffect(() => {
    queueRef.current = queuedMessages;
  }, [queuedMessages]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const stopWatching = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsWatching(false);
  }, []);

  const startWatching = useCallback(
    (id: string) => {
      stopWatching();

      const url = `/api/sessions/watch?id=${encodeURIComponent(id)}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener("connected", (e) => {
        setIsWatching(true);
        try {
          const data = JSON.parse(e.data);
          if (data.isActive === true) {
            setIsStreaming(true);
          }
        } catch {
          // ignore
        }
      });

      es.addEventListener("update", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.modifiedAt && data.modifiedAt > lastModifiedRef.current) {
            lastModifiedRef.current = data.modifiedAt;
            if (data.messages?.length > 0) setMessages(data.messages);
            if (data.toolCalls?.length > 0) setToolCalls(data.toolCalls);
          }
          if (data.isActive === false && !abortRef.current) {
            setIsStreaming(false);
          }
        } catch {
          // malformed event
        }
      });

      es.addEventListener("error", () => {
        // EventSource auto-reconnects
      });
    },
    [stopWatching],
  );

  useEffect(() => {
    return () => {
      stopWatching();
      abortRef.current?.abort();
    };
  }, [stopWatching]);

  const clearChat = useCallback(() => {
    stopWatching();
    setMessages([]);
    setToolCalls([]);
    setSessionId(null);
    setModel(null);
    setError(null);
    setQueuedMessages([]);
  }, [stopWatching]);

  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (sessionIdRef.current) {
      apiFetch("/api/sessions/active", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      }).catch(() => {});
    }
    setIsStreaming(false);
  }, []);

  const loadSession = useCallback(
    async (id: string) => {
      stopWatching();
      setIsLoadingHistory(true);
      setError(null);
      setMessages([]);
      setToolCalls([]);
      setSessionId(id);
      lastModifiedRef.current = 0;

      try {
        const res = await apiFetch(`/api/sessions/history?id=${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error("Failed to load session");
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
        if (data.toolCalls && data.toolCalls.length > 0) {
          setToolCalls(data.toolCalls);
        }
        if (data.modifiedAt) {
          lastModifiedRef.current = data.modifiedAt;
        }
        startWatching(id);

        const active = await fetchActiveSessions();
        if (active.includes(id)) {
          setIsStreaming(true);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load session";
        setError(msg);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [stopWatching, startWatching],
  );

  const sendMessage = useCallback(
    async (prompt: string, overrides?: { model?: string; mode?: AgentMode }) => {
      if (isStreaming) {
        const queued: QueuedMessage = {
          id: uuid(),
          content: prompt,
          timestamp: Date.now(),
          model: selectedModel,
          mode: selectedMode,
        };
        setQueuedMessages((prev) => [...prev, queued]);
        return;
      }

      stopWatching();
      setError(null);
      setIsStreaming(true);

      const userMessage: ChatMessage = {
        id: uuid(),
        role: "user",
        content: prompt,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      const effectiveModel = overrides?.model ?? selectedModel;
      const effectiveMode = overrides?.mode ?? selectedMode;

      const body: ChatRequest = {
        prompt,
        sessionId: sessionIdRef.current ?? undefined,
        model: effectiveModel !== "auto" ? effectiveModel : undefined,
        mode: effectiveMode !== "agent" ? effectiveMode : undefined,
      };

      abortRef.current = new AbortController();
      let currentAssistantId: string | null = null;

      try {
        const res = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(line);
            } catch {
              continue;
            }

            if (parsed.type === "error") {
              setError((parsed.message as string) || "Unknown CLI error");
              continue;
            }

            const event = parsed as unknown as StreamEvent;

            try {
              switch (event.type) {
                case "system": {
                  if (event.subtype === "init") {
                    sessionIdRef.current = event.session_id;
                    setSessionId(event.session_id);
                    setModel(event.model);
                  }
                  break;
                }

                case "assistant": {
                  const text = extractAssistantText(
                    event.message as unknown as Record<string, unknown>,
                  );
                  if (!text) break;

                  if (!currentAssistantId) {
                    currentAssistantId = uuid();
                    const msg: ChatMessage = {
                      id: currentAssistantId,
                      role: "assistant",
                      content: text,
                      timestamp: Date.now(),
                    };
                    setMessages((prev) => [...prev, msg]);
                  } else {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === currentAssistantId ? { ...m, content: m.content + text } : m,
                      ),
                    );
                  }
                  break;
                }

                case "tool_call": {
                  if (event.subtype === "started") {
                    const info = extractToolCallInfo(event.tool_call, event.call_id, "running");
                    const tc: ToolCallInfo = {
                      id: uuid(),
                      callId: event.call_id,
                      type: info.type || "other",
                      name: info.name || "Tool",
                      path: info.path,
                      command: info.command,
                      args: info.args,
                      todos: info.todos,
                      status: "running",
                      timestamp: Date.now(),
                    };
                    setToolCalls((prev) => {
                      const next = [...prev, tc];
                      return next.length > 500 ? next.slice(-500) : next;
                    });
                  } else if (event.subtype === "completed") {
                    const info = extractToolCallInfo(event.tool_call, event.call_id, "completed");
                    setToolCalls((prev) =>
                      prev.map((tc) =>
                        tc.callId === event.call_id
                          ? {
                              ...tc,
                              status: "completed",
                              result: info.result,
                              diff: info.diff,
                              diffStartLine: info.diffStartLine,
                              todos: info.todos,
                            }
                          : tc,
                      ),
                    );
                  }
                  break;
                }

                case "result": {
                  if (!sessionIdRef.current && event.session_id) {
                    sessionIdRef.current = event.session_id;
                    setSessionId(event.session_id);
                  }
                  break;
                }
              }
            } catch {
              // skip malformed events
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;

        const pending = queueRef.current;
        if (pending.length > 0) {
          const next = pending[0];
          setQueuedMessages((prev) => prev.slice(1));
          const overrides =
            next.model || next.mode ? { model: next.model, mode: next.mode } : undefined;
          setTimeout(() => {
            sendMessageRef.current?.(next.content, overrides);
          }, 0);
        } else if (sessionIdRef.current) {
          startWatching(sessionIdRef.current);
        }
      }
    },
    [isStreaming, selectedModel, selectedMode, stopWatching, startWatching],
  );

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    if (!isStreaming || !sessionId) return;
    if (abortRef.current) return;

    const interval = setInterval(async () => {
      const active = await fetchActiveSessions();
      if (!active.includes(sessionIdRef.current ?? "")) {
        setIsStreaming(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isStreaming, sessionId]);

  const forceSendQueued = useCallback((id: string) => {
    const msg = queueRef.current.find((m) => m.id === id);
    if (!msg) return;
    setQueuedMessages((prev) => prev.filter((m) => m.id !== id));
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
    const overrides =
      msg.model || msg.mode ? { model: msg.model, mode: msg.mode } : undefined;
    setTimeout(() => {
      sendMessageRef.current?.(msg.content, overrides);
    }, 0);
  }, []);

  const editQueued = useCallback((id: string, newContent: string) => {
    setQueuedMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: newContent } : m)));
  }, []);

  const deleteQueued = useCallback((id: string) => {
    setQueuedMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const retryLastMessage = useCallback(() => {
    if (isStreaming) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    const prompt = lastUserMsg.content;
    const idx = messages.findIndex((m) => m.id === lastUserMsg.id);
    if (idx >= 0) {
      setMessages(messages.slice(0, idx));
    }
    setToolCalls((prev) => prev.filter((tc) => tc.timestamp < lastUserMsg.timestamp));
    void sendMessage(prompt).catch(() => {});
  }, [isStreaming, messages, sendMessage]);

  return {
    messages,
    toolCalls,
    sessionId,
    isStreaming,
    isLoadingHistory,
    isWatching,
    model,
    selectedModel,
    selectedMode,
    error,
    queuedMessages,
    sendMessage,
    loadSession,
    setSessionId,
    setSelectedModel,
    setSelectedMode,
    clearChat,
    stopStreaming,
    retryLastMessage,
    forceSendQueued,
    editQueued,
    deleteQueued,
  };
}
