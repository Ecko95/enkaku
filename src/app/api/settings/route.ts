import { getAllConfig, setConfig } from "@/lib/session-store";
import { serverError } from "@/lib/errors";
import { broadcast } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

const BOOL_KEYS = new Set(["trust", "sound", "pwa_prompt"]);
const STRING_KEYS = new Set(["default_model", "starred_projects", "webhook_url", "terminal_policy"]);

export async function GET() {
  try {
    const raw = await getAllConfig();
    const settings: Record<string, boolean | string> = {
      trust: true,
      sound: true,
      pwa_prompt: true,
      default_model: "auto",
      starred_projects: "[]",
      webhook_url: "",
      terminal_policy: "unrestricted",
    };
    for (const [key, value] of Object.entries(raw)) {
      if (BOOL_KEYS.has(key)) {
        settings[key] = value === "1";
      } else if (STRING_KEYS.has(key)) {
        settings[key] = value;
      }
    }
    return Response.json({ settings });
  } catch {
    return serverError("Failed to load settings");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const updates: Record<string, boolean | string> = {};

    for (const [key, value] of Object.entries(body)) {
      if (BOOL_KEYS.has(key) && typeof value === "boolean") {
        await setConfig(key, value ? "1" : "0");
        updates[key] = value;
      } else if (STRING_KEYS.has(key) && typeof value === "string") {
        await setConfig(key, value);
        updates[key] = value;
      }
    }

    broadcast("settings_change", updates);
    return Response.json({ settings: updates });
  } catch {
    return serverError("Failed to update settings");
  }
}
