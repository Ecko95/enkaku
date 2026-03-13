"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useHaptics } from "@/hooks/use-haptics";
import { fetchActiveSessions } from "@/hooks/use-chat";
import { ChatContainer } from "./chat-container";
import { SessionSidebar } from "./session-sidebar";
import { QrModal } from "./qr-modal";
import { ErrorBoundary } from "./error-boundary";
import { uuid } from "@/lib/uuid";

interface ChatInstance {
  id: string;
  sessionId: string | null;
  label: string;
  isStreaming: boolean;
  initialSessionId?: string;
}

function makeInstance(initialSessionId?: string): ChatInstance {
  return {
    id: uuid(),
    sessionId: null,
    label: initialSessionId ? "Loading..." : "New chat",
    isStreaming: false,
    initialSessionId,
  };
}

export function ChatWorkspace() {
  const [instances, setInstances] = useState<ChatInstance[]>(() => [makeInstance()]);
  const [activeId, setActiveId] = useState<string>(() => instances[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const haptics = useHaptics();
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    fetchActiveSessions().then((activeIds) => {
      if (activeIds.length === 0) return;

      setInstances((prev) => {
        const newInstances = [...prev];
        let focusId: string | null = null;

        for (let i = 0; i < activeIds.length; i++) {
          const sessionId = activeIds[i];
          if (newInstances.some((inst) => inst.initialSessionId === sessionId || inst.sessionId === sessionId)) {
            continue;
          }

          const inst = makeInstance(sessionId);

          if (i === 0 && newInstances.length === 1 && !newInstances[0].sessionId && !newInstances[0].isStreaming) {
            newInstances[0] = inst;
            focusId = inst.id;
          } else {
            newInstances.push(inst);
            if (!focusId) focusId = inst.id;
          }
        }

        if (focusId) {
          const id = focusId;
          setTimeout(() => setActiveId(id), 0);
        }
        return newInstances;
      });
    });
  }, []);

  const activeStatuses = useMemo(() => {
    const map: Record<string, "streaming" | "idle"> = {};
    for (const inst of instances) {
      if (inst.sessionId) {
        map[inst.sessionId] = inst.isStreaming ? "streaming" : "idle";
      }
    }
    return map;
  }, [instances]);

  const handleNewSession = useCallback(() => {
    haptics.tap();
    const current = instances.find((i) => i.id === activeId);
    if (current && !current.sessionId && !current.isStreaming) return;
    const inst = makeInstance();
    setInstances((prev) => [...prev, inst]);
    setActiveId(inst.id);
  }, [haptics, instances, activeId]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      const existing = instances.find((i) => i.sessionId === sessionId);
      if (existing) {
        setActiveId(existing.id);
        return;
      }

      const inst = makeInstance(sessionId);
      const current = instances.find((i) => i.id === activeId);

      if (current && !current.sessionId && !current.isStreaming) {
        setInstances((prev) => prev.map((i) => (i.id === activeId ? inst : i)));
      } else {
        setInstances((prev) => [...prev, inst]);
      }
      setActiveId(inst.id);
    },
    [instances, activeId],
  );

  const updateLabel = useCallback((instanceId: string, label: string) => {
    setInstances((prev) => prev.map((i) => (i.id === instanceId ? { ...i, label } : i)));
  }, []);

  const updateStreaming = useCallback((instanceId: string, isStreaming: boolean) => {
    setInstances((prev) => prev.map((i) => (i.id === instanceId ? { ...i, isStreaming } : i)));
  }, []);

  const updateSessionId = useCallback((instanceId: string, sessionId: string | null) => {
    setInstances((prev) => prev.map((i) => (i.id === instanceId ? { ...i, sessionId } : i)));
  }, []);

  const currentSessionId = instances.find((i) => i.id === activeId)?.sessionId ?? null;

  return (
    <div className="h-dvh">
      {instances.map((inst) => (
        <div key={inst.id} className={inst.id === activeId ? "h-full" : "hidden"}>
          <ErrorBoundary fallback="inline">
            <ChatContainer
              initialSessionId={inst.initialSessionId}
              onLabelChange={(label) => updateLabel(inst.id, label)}
              onStreamingChange={(s) => updateStreaming(inst.id, s)}
              onSessionIdChange={(sid) => updateSessionId(inst.id, sid)}
              onSelectSession={handleSelectSession}
              onOpenSidebar={() => setSidebarOpen(true)}
              onOpenQr={() => setQrOpen(true)}
            />
          </ErrorBoundary>
        </div>
      ))}

      <SessionSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        activeStatuses={activeStatuses}
      />

      <QrModal open={qrOpen} onClose={() => setQrOpen(false)} />
    </div>
  );
}
