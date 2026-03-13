"use client";

import { useEffect, useState, useCallback } from "react";
import type { StoredSession } from "@/lib/types";
import { useHaptics } from "@/hooks/use-haptics";
import { apiFetch } from "@/lib/api-fetch";
import { timeAgo } from "@/lib/format";

interface SessionSidebarProps {
  open: boolean;
  onClose: () => void;
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  activeStatuses?: Record<string, "streaming" | "idle">;
}

function StatusIndicator({ status }: { status: "streaming" | "idle" }) {
  if (status === "streaming") {
    return (
      <span className="shrink-0 w-2 h-2 rounded-full border-[1.5px] border-success border-t-transparent animate-spin" />
    );
  }
  return <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-text-muted/40" />;
}

export function SessionSidebar({
  open,
  onClose,
  currentSessionId,
  onSelectSession,
  onNewSession,
  activeStatuses = {},
}: SessionSidebarProps) {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const haptics = useHaptics();

  const fetchSessions = useCallback(() => {
    const params = showAll ? "?all=true" : "";
    return apiFetch("/api/sessions" + params)
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions || []))
      .catch((err) => console.warn("Failed to fetch sessions:", err));
  }, [showAll]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- loading state for fetch
    setConfirmingDelete(null);
    fetchSessions().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, fetchSessions]);

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (confirmingDelete === sessionId) {
      haptics.error();
      apiFetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then(() => fetchSessions())
        .catch((err) => console.warn("Failed to delete session:", err))
        .finally(() => setConfirmingDelete(null));
    } else {
      haptics.warn();
      setConfirmingDelete(sessionId);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingDelete(null);
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-[280px] bg-bg-elevated border-r border-border transform transition-transform duration-150 flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-11 px-3 border-b border-border shrink-0">
          <span className="text-[13px] font-medium text-text-secondary">Sessions</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                haptics.tap();
                setLoading(true);
                fetchSessions().finally(() => setLoading(false));
              }}
              disabled={loading}
              className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors disabled:opacity-40"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={loading ? "animate-spin" : ""}
              >
                <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-2 pt-2 pb-1 space-y-1 shrink-0">
          <button
            onClick={() => {
              onNewSession();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New session
          </button>
          <button
            onClick={() => {
              haptics.tap();
              setShowAll((v) => !v);
            }}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
              showAll
                ? "text-text bg-bg-active"
                : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
            }`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            All workspaces
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-2 pb-2">
          {loading ? (
            <div className="flex items-center gap-2 justify-center py-8 text-text-muted text-[12px]">
              <span className="w-3 h-3 rounded-full border-2 border-text-muted border-t-transparent animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-text-muted text-[12px] text-center py-8">No sessions</p>
          ) : (
            sessions.map((s) => {
              const status = activeStatuses[s.id];
              return (
                <div key={s.id} className="relative mb-px">
                  <button
                    onClick={() => {
                      haptics.select();
                      onSelectSession(s.id);
                      onClose();
                    }}
                    className={`group w-full text-left px-2.5 py-2 rounded-md transition-colors ${
                      s.id === currentSessionId
                        ? "bg-bg-active text-text"
                        : "hover:bg-bg-hover text-text-secondary"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-5">
                        {status && <StatusIndicator status={status} />}
                        <p className="text-[12px] truncate">{s.title}</p>
                      </div>
                      <span className="text-[10px] text-text-muted shrink-0">
                        {timeAgo(s.updatedAt)}
                      </span>
                    </div>
                    {showAll && (
                      <p className="text-[10px] text-text-muted mt-0.5 font-mono truncate">
                        {s.workspace.split("/").pop()}
                      </p>
                    )}
                  </button>

                  {confirmingDelete === s.id ? (
                    <div className="absolute top-1 right-1 flex items-center gap-1">
                      <button
                        onClick={(e) => handleDeleteClick(e, s.id)}
                        className="px-2 py-1 rounded text-[10px] font-medium bg-error/15 text-error hover:bg-error/25 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={handleCancelDelete}
                        className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => handleDeleteClick(e, s.id)}
                      className="absolute top-1 right-1 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-bg-surface text-text-muted hover:text-error transition-all"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
