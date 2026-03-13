import { spawn, type ChildProcess } from "child_process";
import type { AgentMode } from "@/lib/types";

export interface AgentOptions {
  prompt: string;
  sessionId?: string;
  workspace?: string;
  model?: string;
  mode?: AgentMode;
}

export function spawnAgent(options: AgentOptions): ChildProcess {
  const args = ["-p", options.prompt, "--output-format", "stream-json", "--stream-partial-output"];

  if (process.env.CURSOR_TRUST === "1") {
    args.push("--trust");
  }
  if (options.sessionId) {
    args.push("--resume", options.sessionId);
  }
  if (options.workspace) {
    args.push("--workspace", options.workspace);
  }
  if (options.model) {
    args.push("--model", options.model);
  }
  if (options.mode && options.mode !== "agent") {
    args.push("--mode", options.mode);
  }

  return spawn("agent", args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });
}

export function createStreamFromProcess(child: ChildProcess): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      let buffer = "";
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      const enqueue = (data: Uint8Array) => {
        if (closed) return;
        controller.enqueue(data);
      };

      child.stdout?.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            enqueue(encoder.encode(line + "\n"));
          }
        }
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        const errorEvent = JSON.stringify({
          type: "error",
          message: chunk.toString().trim() || "Agent process error",
        });
        enqueue(encoder.encode(errorEvent + "\n"));
      });

      child.on("close", () => {
        if (buffer.trim()) {
          enqueue(encoder.encode(buffer + "\n"));
        }
        close();
      });

      child.on("error", (err) => {
        const errorEvent = JSON.stringify({
          type: "error",
          message: err.message,
        });
        enqueue(encoder.encode(errorEvent + "\n"));
        close();
      });
    },

    cancel() {
      // intentionally NOT killing the child process here --
      // it should keep running even if the browser disconnects
    },
  });
}
