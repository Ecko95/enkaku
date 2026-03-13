"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { CloseIcon } from "./icons";

interface Settings {
  trust: boolean;
  notifications: boolean;
  sound: boolean;
}

const DEFAULTS: Settings = { trust: true, notifications: true, sound: true };

const LABELS: Record<keyof Settings, { label: string; description: string }> = {
  trust: {
    label: "Workspace trust",
    description: "Allow the agent to execute code and edit files without asking",
  },
  notifications: {
    label: "Notifications",
    description: "Show browser notifications when the agent finishes",
  },
  sound: {
    label: "Sound effects",
    description: "Play sounds on completion and errors",
  },
};

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- loading state for fetch
    apiFetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSettings({ ...DEFAULTS, ...data.settings });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open]);

  const toggle = useCallback((key: keyof Settings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      apiFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      }).catch(() => {
        setSettings(prev);
      });
      return next;
    });
  }, []);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60" aria-hidden="true" onClick={onClose} />}
      <div
        role="dialog"
        aria-label="Settings"
        aria-hidden={!open}
        className={`fixed top-0 right-0 z-50 h-full w-[300px] bg-bg-elevated border-l border-border transform transition-transform duration-150 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-11 px-3 border-b border-border shrink-0">
          <span className="text-[13px] font-medium text-text-secondary">Settings</span>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-text-muted border-t-transparent animate-spin" />
            </div>
          ) : (
            (Object.keys(LABELS) as (keyof Settings)[]).map((key) => (
              <button
                key={key}
                onClick={() => toggle(key)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md hover:bg-bg-hover transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-[12px] text-text">{LABELS[key].label}</p>
                  <p className="text-[11px] text-text-muted mt-0.5 leading-tight">{LABELS[key].description}</p>
                </div>
                <div
                  className={`shrink-0 w-8 h-[18px] rounded-full transition-colors relative ${
                    settings[key] ? "bg-success" : "bg-bg-active"
                  }`}
                >
                  <div
                    className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
                      settings[key] ? "translate-x-[16px]" : "translate-x-[2px]"
                    }`}
                  />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
