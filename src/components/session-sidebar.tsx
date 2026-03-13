"use client";

import { useEffect, useState, useCallback } from "react";
import type { StoredSession } from "@/lib/types";
import { useHaptics } from "@/hooks/use-haptics";
import { apiFetch } from "@/lib/api-fetch";
import { timeAgo } from "@/lib/format";
import { RefreshIcon, CloseIcon, PlusIcon, GlobeIcon, Spinner, TrashIcon } from "./icons";

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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const haptics = useHaptics();

  const fetchSessions = useCallback(() => {
    setFetchError(null);
    const params = showAll ? "?all=true" : "";
    return apiFetch("/api/sessions" + params)
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => setFetchError("Failed to load sessions"));
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
        .catch(() => setFetchError("Failed to delete session"))
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
      {open && <div className="fixed inset-0 z-40 bg-black/60" aria-hidden="true" onClick={onClose} />}
      <div
        role="dialog"
        aria-label="Session history"
        aria-hidden={!open}
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
              aria-label="Refresh sessions"
              className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors disabled:opacity-40"
            >
              <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              aria-label="Close sidebar"
              className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors"
            >
              <CloseIcon size={14} />
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
            <PlusIcon />
            New session
          </button>
          <button
            onClick={() => {
              haptics.tap();
              setShowAll((v) => !v);
            }}
            aria-pressed={showAll}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
              showAll
                ? "text-text bg-bg-active"
                : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
            }`}
          >
            <GlobeIcon />
            All workspaces
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-2 pb-2">
          {fetchError && (
            <div className="mx-1 mb-2 px-2.5 py-2 rounded-md bg-error/10 text-error text-[11px]">
              {fetchError}
            </div>
          )}
          {loading ? (
            <div className="flex items-center gap-2 justify-center py-8 text-text-muted text-[12px]">
              <Spinner />
            </div>
          ) : sessions.length === 0 && !fetchError ? (
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
                    aria-current={s.id === currentSessionId ? "true" : undefined}
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
                        aria-label="Cancel delete"
                        className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
                      >
                        <CloseIcon size={10} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => handleDeleteClick(e, s.id)}
                      aria-label="Delete session"
                      className="absolute top-1 right-1 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-bg-surface text-text-muted hover:text-error transition-all"
                    >
                      <TrashIcon />
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
