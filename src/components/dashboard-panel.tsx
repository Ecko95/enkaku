"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { CloseIcon, RefreshIcon, Spinner } from "./icons";

interface HealthData {
  uptime: { process: number; system: number };
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    systemTotal: number;
    systemFree: number;
  };
  cpu: { load1m: number; load5m: number; load15m: number };
  agents: { active: number; sessionIds: string[] };
  terminals: { total: number; running: number };
  clients: { connected: number };
  workspace: string;
  recentAudit: { event: string; detail: string; timestamp: number }[];
  nodeVersion: string;
  platform: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-3 py-2.5 rounded-md bg-bg-surface border border-border">
      <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
      <p className="text-[16px] font-semibold text-text mt-0.5 tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

interface DashboardPanelProps {
  open: boolean;
  onClose: () => void;
}

export function DashboardPanel({ open, onClose }: DashboardPanelProps) {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(() => {
    apiFetch("/api/health")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchHealth();
    const id = setInterval(fetchHealth, 10_000);
    return () => clearInterval(id);
  }, [open, fetchHealth]);

  const memPercent = data
    ? Math.round((1 - data.memory.systemFree / data.memory.systemTotal) * 100)
    : 0;

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60" aria-hidden="true" onClick={onClose} />}
      <div
        role="dialog"
        aria-label="System dashboard"
        aria-hidden={!open}
        className={`fixed inset-0 z-50 bg-bg-elevated transform transition-transform duration-150 flex flex-col sm:inset-auto sm:top-0 sm:right-0 sm:h-full sm:w-[340px] sm:border-l sm:border-border ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-11 px-3 border-b border-border shrink-0">
          <span className="text-[13px] font-medium text-text-secondary">System Status</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => { setLoading(true); fetchHealth(); }}
              disabled={loading}
              aria-label="Refresh"
              className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors disabled:opacity-40"
            >
              <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              aria-label="Close dashboard"
              className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-3">
          {loading && !data ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : data ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="Uptime" value={formatUptime(data.uptime.process)} />
                <StatCard label="Clients" value={String(data.clients.connected)} sub="connected devices" />
                <StatCard label="Agents" value={String(data.agents.active)} sub="active sessions" />
                <StatCard label="Terminals" value={`${data.terminals.running}/${data.terminals.total}`} sub="running / total" />
              </div>

              <div className="space-y-2">
                <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider px-1">Memory</p>
                <div className="px-3 py-2.5 rounded-md bg-bg-surface border border-border space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-muted">System</span>
                    <span className="text-text tabular-nums">{formatBytes(data.memory.systemTotal - data.memory.systemFree)} / {formatBytes(data.memory.systemTotal)}</span>
                  </div>
                  <div className="h-1.5 bg-bg-active rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${memPercent > 85 ? "bg-error" : memPercent > 70 ? "bg-warning" : "bg-success"}`}
                      style={{ width: `${memPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-muted">Process heap</span>
                    <span className="text-text tabular-nums">{formatBytes(data.memory.heapUsed)} / {formatBytes(data.memory.heapTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-muted">RSS</span>
                    <span className="text-text tabular-nums">{formatBytes(data.memory.rss)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider px-1">CPU Load</p>
                <div className="px-3 py-2.5 rounded-md bg-bg-surface border border-border">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-muted">1m / 5m / 15m</span>
                    <span className="text-text tabular-nums font-mono">
                      {data.cpu.load1m.toFixed(2)} / {data.cpu.load5m.toFixed(2)} / {data.cpu.load15m.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {data.recentAudit.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider px-1">Recent Activity</p>
                  <div className="space-y-px">
                    {data.recentAudit.map((entry, i) => (
                      <div key={i} className="px-3 py-1.5 rounded-md hover:bg-bg-hover transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-text-secondary">{entry.event}</span>
                          <span className="text-[10px] text-text-muted">{timeAgo(entry.timestamp)}</span>
                        </div>
                        <p className="text-[10px] text-text-muted truncate">{entry.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider px-1">Environment</p>
                <div className="px-3 py-2.5 rounded-md bg-bg-surface border border-border space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-muted">Node</span>
                    <span className="text-text font-mono">{data.nodeVersion}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-muted">Platform</span>
                    <span className="text-text font-mono">{data.platform}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-muted">Workspace</span>
                    <span className="text-text font-mono truncate ml-2 max-w-[180px]">{data.workspace.split("/").pop()}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-text-muted text-[12px] text-center py-8">Failed to load health data</p>
          )}
        </div>
      </div>
    </>
  );
}
