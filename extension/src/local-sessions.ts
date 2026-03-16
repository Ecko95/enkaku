import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Reads the agent-transcripts directory for the current workspace
 * to determine which session IDs were created locally (by this IDE instance).
 *
 * Cursor stores transcripts at:
 *   ~/.cursor/projects/<project-key>/agent-transcripts/<sessionId>/
 */
export function getLocalSessionIds(workspacePath: string | undefined): Set<string> {
  const ids = new Set<string>();
  if (!workspacePath) { return ids; }

  const cursorProjectsDir = path.join(os.homedir(), ".cursor", "projects");
  const projectKey = workspacePath.replace(/^\//, "").replace(/\//g, "-");
  const transcriptsDir = path.join(cursorProjectsDir, projectKey, "agent-transcripts");

  try {
    const entries = fs.readdirSync(transcriptsDir);
    for (const entry of entries) {
      const name = entry.replace(".jsonl", "");
      ids.add(name);
    }
  } catch {
    // directory doesn't exist or can't be read
  }

  return ids;
}
