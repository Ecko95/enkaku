"use client";

import { useEffect, useState, useCallback } from "react";
import type { ModelInfo } from "@/lib/types";
import { apiFetch } from "@/lib/api-fetch";
import { CloseIcon, ChevronDown } from "./icons";

interface Settings {
  trust: boolean;
  sound: boolean;
  default_model: string;
}

const DEFAULTS: Settings = { trust: true, sound: true, default_model: "auto" };

const TOGGLE_LABELS: Record<"trust" | "sound", { label: string; description: string }> = {
  trust: {
    label: "Workspace trust",
    description: "Allow the agent to execute code and edit files without asking",
  },
  sound: {
    label: "Sound effects",
    description: "Play sounds on completion and errors",
  },
};

const TOGGLE_KEYS = Object.keys(TOGGLE_LABELS) as (keyof typeof TOGGLE_LABELS)[];

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  onDefaultModelChange?: (model: string) => void;
}

export function SettingsPanel({ open, onClose, onDefaultModelChange }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- loading state for fetch
    Promise.all([
      apiFetch("/api/settings").then((r) => r.json()),
      apiFetch("/api/models").then((r) => r.json()),
    ])
      .then(([settingsData, modelsData]) => {
        if (cancelled) return;
        setSettings({ ...DEFAULTS, ...settingsData.settings });
        if (modelsData.models?.length > 0) setModels(modelsData.models);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open]);

  const toggle = useCallback((key: keyof typeof TOGGLE_LABELS) => {
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

  const handleModelSelect = useCallback((modelId: string) => {
    setSettings((prev) => {
      const next = { ...prev, default_model: modelId };
      apiFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_model: modelId }),
      }).catch(() => {
        setSettings(prev);
      });
      return next;
    });
    onDefaultModelChange?.(modelId);
    setModelDropdownOpen(false);
  }, [onDefaultModelChange]);

  const currentModelLabel = models.find((m) => m.id === settings.default_model)?.label || settings.default_model;

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
            <>
              {TOGGLE_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md hover:bg-bg-hover transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] text-text">{TOGGLE_LABELS[key].label}</p>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-tight">{TOGGLE_LABELS[key].description}</p>
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
              ))}

              <div className="pt-3 mt-2 border-t border-border">
                <div className="px-3 py-2">
                  <p className="text-[12px] text-text">Default model</p>
                  <p className="text-[11px] text-text-muted mt-0.5 leading-tight">
                    Model used for new sessions
                  </p>
                </div>
                <div className="relative px-3">
                  <button
                    onClick={() => setModelDropdownOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-bg-surface border border-border text-[12px] text-text hover:bg-bg-hover transition-colors"
                  >
                    <span className="truncate">{currentModelLabel}</span>
                    <ChevronDown />
                  </button>
                  {modelDropdownOpen && models.length > 0 && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
                      <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-bg-elevated border border-border rounded-lg shadow-xl py-1 max-h-60 overflow-y-auto">
                        {models.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => handleModelSelect(m.id)}
                            className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors ${
                              settings.default_model === m.id
                                ? "text-text bg-bg-active"
                                : "text-text-secondary hover:bg-bg-hover hover:text-text"
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
