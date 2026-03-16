"use client";

import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { useHaptics } from "@/hooks/use-haptics";
import { CloseIcon, FileIcon, FolderIcon, Spinner } from "./icons";

interface FileEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  modified: number;
}

interface FileBrowserProps {
  open: boolean;
  onClose: () => void;
  workspace?: string;
  onInsertPath?: (path: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

export function FileBrowser({ open, onClose, workspace, onInsertPath }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ name: string; content: string; truncated: boolean } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const haptics = useHaptics();

  const fetchFiles = useCallback((path: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (workspace) params.set("workspace", workspace);
    if (path) params.set("path", path);
    const qs = params.toString();

    apiFetch(`/api/files${qs ? "?" + qs : ""}`)
      .then((r) => r.json())
      .then((data) => {
        setFiles(data.files || []);
        setCurrentPath(data.path || ".");
      })
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [workspace]);

  useEffect(() => {
    if (open) {
      fetchFiles("");
      setPreview(null);
    }
  }, [open, fetchFiles]);

  const handleNavigate = useCallback((entry: FileEntry) => {
    haptics.tap();
    if (entry.type === "directory") {
      const newPath = currentPath === "." ? entry.name : `${currentPath}/${entry.name}`;
      fetchFiles(newPath);
      setPreview(null);
    } else {
      setPreviewLoading(true);
      const filePath = currentPath === "." ? entry.name : `${currentPath}/${entry.name}`;
      const params = new URLSearchParams({ action: "read", path: filePath });
      if (workspace) params.set("workspace", workspace);

      apiFetch(`/api/files?${params}`)
        .then((r) => r.json())
        .then((data) => {
          setPreview({
            name: entry.name,
            content: data.content || "",
            truncated: data.truncated || false,
          });
        })
        .catch(() => setPreview({ name: entry.name, content: "[Failed to read file]", truncated: false }))
        .finally(() => setPreviewLoading(false));
    }
  }, [currentPath, workspace, fetchFiles, haptics]);

  const handleGoUp = useCallback(() => {
    haptics.tap();
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    fetchFiles(parts.join("/"));
    setPreview(null);
  }, [currentPath, fetchFiles, haptics]);

  const handleInsert = useCallback((name: string) => {
    haptics.select();
    const fullPath = currentPath === "." ? name : `${currentPath}/${name}`;
    onInsertPath?.(fullPath);
    onClose();
  }, [currentPath, onInsertPath, onClose, haptics]);

  const breadcrumbs = currentPath === "." ? [] : currentPath.split("/").filter(Boolean);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60" aria-hidden="true" onClick={onClose} />}
      <div
        role="dialog"
        aria-label="File browser"
        aria-hidden={!open}
        className={`fixed inset-0 z-50 bg-bg-elevated transform transition-transform duration-150 flex flex-col sm:inset-auto sm:top-0 sm:right-0 sm:h-full sm:w-[380px] sm:border-l sm:border-border ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-11 px-3 border-b border-border shrink-0">
          <span className="text-[13px] font-medium text-text-secondary">Files</span>
          <button
            onClick={onClose}
            aria-label="Close file browser"
            className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1 px-3 py-2 border-b border-border text-[11px] text-text-muted overflow-x-auto shrink-0">
          <button
            onClick={() => { fetchFiles(""); setPreview(null); }}
            className="hover:text-text-secondary transition-colors shrink-0"
          >
            root
          </button>
          {breadcrumbs.map((part, i) => (
            <span key={i} className="flex items-center gap-1 shrink-0">
              <span className="text-text-muted/40">/</span>
              <button
                onClick={() => {
                  fetchFiles(breadcrumbs.slice(0, i + 1).join("/"));
                  setPreview(null);
                }}
                className="hover:text-text-secondary transition-colors"
              >
                {part}
              </button>
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : preview ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
                <span className="text-[12px] text-text font-mono truncate">{preview.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleInsert(preview.name)}
                    className="px-2 py-1 rounded text-[10px] text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
                  >
                    Insert path
                  </button>
                  <button
                    onClick={() => setPreview(null)}
                    className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <CloseIcon size={10} />
                  </button>
                </div>
              </div>
              <pre className="flex-1 overflow-auto p-3 text-[11px] text-text-secondary font-mono leading-relaxed whitespace-pre-wrap break-all">
                {previewLoading ? "Loading..." : preview.content}
                {preview.truncated && "\n\n[... truncated ...]"}
              </pre>
            </div>
          ) : (
            <>
              {currentPath !== "." && (
                <button
                  onClick={handleGoUp}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-hover transition-colors text-[12px] text-text-muted"
                >
                  <span className="text-text-muted/60">..</span>
                </button>
              )}
              {files.map((f) => (
                <button
                  key={f.name}
                  onClick={() => handleNavigate(f)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover transition-colors group"
                >
                  {f.type === "directory" ? (
                    <FolderIcon size={12} className="shrink-0 text-text-muted" />
                  ) : (
                    <FileIcon size={12} className="shrink-0 text-text-muted" />
                  )}
                  <span className="text-[12px] text-text-secondary truncate flex-1 text-left">{f.name}</span>
                  {f.type === "file" && (
                    <span className="text-[10px] text-text-muted/50 shrink-0">{formatSize(f.size)}</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleInsert(f.name); }}
                    className="shrink-0 px-1.5 py-0.5 rounded text-[9px] text-text-muted opacity-0 group-hover:opacity-100 hover:bg-bg-surface transition-all"
                  >
                    insert
                  </button>
                </button>
              ))}
              {files.length === 0 && (
                <p className="text-text-muted text-[12px] text-center py-8">Empty directory</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
