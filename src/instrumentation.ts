export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerShutdownHandler } = await import("@/lib/shutdown");
    registerShutdownHandler();

    const { setProcessExitHook } = await import("@/lib/process-registry");
    const { notifyAllSubscribers } = await import("@/lib/push");
    const { getDb } = await import("@/lib/session-store");

    setProcessExitHook((sessionId, _workspace) => {
      let title = "Agent finished";
      let body = "Response complete";

      void (async () => {
        try {
          const conn = await getDb();
          const stmt = conn.prepare("SELECT title, preview FROM sessions WHERE id = ?");
          try {
            stmt.bind([sessionId]);
            if (stmt.step()) {
              const row = stmt.getAsObject() as { title: string; preview: string };
              title = "Agent finished";
              body = row.preview || row.title;
            }
          } finally {
            stmt.free();
          }
        } catch {
          // db read failed, use defaults
        }

        void notifyAllSubscribers(title, body);
      })();
    });
  }
}
