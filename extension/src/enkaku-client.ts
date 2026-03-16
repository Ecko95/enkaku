import * as http from "http";
import * as https from "https";
import type { StoredSession, SessionDetail } from "./types";

export class EnkakuClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  updateConfig(baseUrl: string, token: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  private fetch(path: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const headers: Record<string, string> = {};
      if (this.token) {
        headers["Authorization"] = `Bearer ${this.token}`;
      }

      const mod = url.protocol === "https:" ? https : http;
      const req = mod.get(
        url.toString(),
        { timeout: 10_000, rejectUnauthorized: false, headers },
        (res) => {
          let body = "";
          res.on("data", (chunk: Buffer) => (body += chunk.toString()));
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
              return;
            }
            try {
              resolve(JSON.parse(body));
            } catch {
              reject(new Error(`Invalid JSON from ${path}`));
            }
          });
        },
      );
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timed out"));
      });
    });
  }

  async getSessions(workspace?: string): Promise<StoredSession[]> {
    const params = new URLSearchParams();
    if (workspace) {
      params.set("workspace", workspace);
    } else {
      params.set("all", "true");
    }
    const data = (await this.fetch(`/api/sessions?${params}`)) as {
      sessions: StoredSession[];
    };
    return data.sessions ?? [];
  }

  async getSessionHistory(
    sessionId: string,
    workspace?: string,
  ): Promise<SessionDetail> {
    const params = new URLSearchParams({ id: sessionId });
    if (workspace) {
      params.set("workspace", workspace);
    }
    const data = (await this.fetch(
      `/api/sessions/history?${params}`,
    )) as SessionDetail;
    return {
      sessionId: data.sessionId ?? sessionId,
      messages: data.messages ?? [],
      toolCalls: data.toolCalls ?? [],
      modifiedAt: data.modifiedAt ?? 0,
    };
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.fetch("/api/health");
      return true;
    } catch {
      try {
        await this.fetch("/api/info");
        return true;
      } catch {
        return false;
      }
    }
  }
}
