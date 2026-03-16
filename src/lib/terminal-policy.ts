import { getConfig } from "@/lib/session-store";

export type TerminalPolicy = "unrestricted" | "restricted";

const DANGEROUS_PATTERNS = [
  /rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?\/(?!\w)/,
  /rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+\//,
  /mkfs\b/,
  /dd\s+if=/,
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/,
  /shutdown\b/,
  /reboot\b/,
  /init\s+[06]/,
  />\s*\/dev\/[sh]d[a-z]/,
  /chmod\s+(-[a-zA-Z]*\s+)?[0-7]*777\s+\//,
  /curl\s.*\|\s*(ba)?sh/,
  /wget\s.*\|\s*(ba)?sh/,
  /python[23]?\s+-c\s+['"]import\s+os;\s*os\.system/,
  /eval\s*\$\(/,
];

export async function getTerminalPolicy(): Promise<TerminalPolicy> {
  const val = await getConfig("terminal_policy");
  if (val === "restricted") return "restricted";
  return "unrestricted";
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkCommand(input: string, policy: TerminalPolicy): PolicyCheckResult {
  if (policy === "unrestricted") {
    return { allowed: true };
  }

  const trimmed = input.trim();
  if (!trimmed) return { allowed: true };

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: `Blocked by terminal policy: command matches dangerous pattern "${pattern.source}"`,
      };
    }
  }

  return { allowed: true };
}
