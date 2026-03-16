import { readdir, readFile, stat } from "fs/promises";
import { join, resolve, relative } from "path";
import { getWorkspace } from "@/lib/workspace";
import { badRequest, serverError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 512 * 1024;
const MAX_PREVIEW_LINES = 500;

const IGNORED_DIRS = new Set([
  "node_modules", ".git", ".next", ".cache", "__pycache__",
  ".turbo", "dist", "build", ".svn", ".hg",
]);

function isPathSafe(root: string, target: string): boolean {
  const resolved = resolve(root, target);
  return resolved.startsWith(root + "/") || resolved === root;
}

interface FileEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  modified: number;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspace = url.searchParams.get("workspace") || getWorkspace();
  const subpath = url.searchParams.get("path") || "";
  const action = url.searchParams.get("action") || "list";

  if (!isPathSafe(workspace, subpath)) {
    return badRequest("Invalid path");
  }

  const targetPath = subpath ? join(workspace, subpath) : workspace;

  try {
    if (action === "read") {
      const fileStat = await stat(targetPath);
      if (!fileStat.isFile()) return badRequest("Not a file");
      if (fileStat.size > MAX_FILE_SIZE) {
        return Response.json({
          content: `[File too large: ${(fileStat.size / 1024).toFixed(1)}KB — max ${MAX_FILE_SIZE / 1024}KB]`,
          truncated: true,
          size: fileStat.size,
        });
      }

      const content = await readFile(targetPath, "utf-8");
      const lines = content.split("\n");
      const truncated = lines.length > MAX_PREVIEW_LINES;

      return Response.json({
        content: truncated ? lines.slice(0, MAX_PREVIEW_LINES).join("\n") : content,
        truncated,
        totalLines: lines.length,
        size: fileStat.size,
      });
    }

    const entries = await readdir(targetPath, { withFileTypes: true });
    const files: FileEntry[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;

      try {
        const entryPath = join(targetPath, entry.name);
        const entryStat = await stat(entryPath);
        files.push({
          name: entry.name,
          type: entry.isDirectory() ? "directory" : "file",
          size: entryStat.size,
          modified: entryStat.mtimeMs,
        });
      } catch {
        // skip unreadable entries
      }
    }

    files.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const rel = relative(workspace, targetPath) || ".";

    return Response.json({
      path: rel,
      workspace,
      files,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to read files";
    return serverError(msg);
  }
}
