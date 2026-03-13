import { getAllConfig, setConfig } from "@/lib/session-store";
import { serverError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const ALLOWED_KEYS = new Set(["trust", "notifications", "sound"]);

export async function GET() {
  try {
    const raw = await getAllConfig();
    const settings: Record<string, boolean> = {
      trust: true,
      notifications: true,
      sound: true,
    };
    for (const [key, value] of Object.entries(raw)) {
      if (ALLOWED_KEYS.has(key)) {
        settings[key] = value === "1";
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
    const updates: Record<string, boolean> = {};

    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_KEYS.has(key) && typeof value === "boolean") {
        await setConfig(key, value ? "1" : "0");
        updates[key] = value;
      }
    }

    return Response.json({ settings: updates });
  } catch {
    return serverError("Failed to update settings");
  }
}
