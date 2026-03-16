import { getDb } from "@/lib/session-store";
import { badRequest, serverError, parseJsonBody } from "@/lib/errors";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

interface TemplateRow {
  id: string;
  name: string;
  template: string;
  category: string;
  usage_count: number;
  created_at: number;
}

const BUILT_IN_TEMPLATES: Omit<TemplateRow, "usage_count" | "created_at">[] = [
  { id: "__review", name: "Review changes", template: "Review the recent changes in this project. Focus on correctness, edge cases, and potential bugs.", category: "review" },
  { id: "__tests", name: "Write tests", template: "Write comprehensive tests for the code I'm working on. Cover edge cases and error paths.", category: "testing" },
  { id: "__explain", name: "Explain this error", template: "Explain this error and suggest a fix:\n\n{{clipboard}}", category: "debug" },
  { id: "__refactor", name: "Refactor for readability", template: "Refactor the current code for better readability and maintainability. Keep the same behavior.", category: "refactor" },
  { id: "__docs", name: "Add documentation", template: "Add clear documentation to the code I'm working on. Include JSDoc comments and inline explanations for complex logic.", category: "docs" },
  { id: "__lint", name: "Fix lint errors", template: "Fix all lint errors and warnings in the current file. Explain each fix.", category: "fix" },
  { id: "__pr", name: "Create PR description", template: "Create a pull request description for the current changes. Include a summary, what changed, and testing notes.", category: "docs" },
  { id: "__perf", name: "Optimize performance", template: "Analyze the current code for performance issues and suggest optimizations.", category: "refactor" },
];

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      template TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'custom',
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);
  tableReady = true;
}

export async function GET() {
  try {
    await ensureTable();
    const db = await getDb();
    const stmt = db.prepare("SELECT * FROM prompt_templates ORDER BY usage_count DESC, created_at DESC");
    const custom: TemplateRow[] = [];
    while (stmt.step()) {
      custom.push(stmt.getAsObject() as unknown as TemplateRow);
    }
    stmt.free();

    const customIds = new Set(custom.map((t) => t.id));
    const builtIn = BUILT_IN_TEMPLATES.filter((t) => !customIds.has(t.id)).map((t) => ({
      ...t,
      usage_count: 0,
      created_at: 0,
      builtIn: true,
    }));

    return Response.json({
      templates: [
        ...custom.map((t) => ({ ...t, builtIn: t.id.startsWith("__") })),
        ...builtIn,
      ],
    });
  } catch {
    return serverError("Failed to load templates");
  }
}

export async function POST(req: Request) {
  try {
    await ensureTable();
    const body = await parseJsonBody<{ name?: string; template?: string; category?: string; id?: string }>(req);
    if (body instanceof Response) return body;

    if (body.id) {
      const db = await getDb();
      db.run("UPDATE prompt_templates SET usage_count = usage_count + 1 WHERE id = ?", [body.id]);
      return Response.json({ ok: true });
    }

    if (!body.name?.trim() || !body.template?.trim()) {
      return badRequest("name and template are required");
    }

    const db = await getDb();
    const id = randomUUID().slice(0, 8);
    db.run(
      "INSERT INTO prompt_templates (id, name, template, category, usage_count, created_at) VALUES (?, ?, ?, ?, 0, ?)",
      [id, body.name.trim(), body.template.trim(), body.category || "custom", Date.now()],
    );

    return Response.json({ id });
  } catch {
    return serverError("Failed to save template");
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureTable();
    const body = await parseJsonBody<{ id?: string }>(req);
    if (body instanceof Response) return body;
    if (!body.id) return badRequest("id is required");

    const db = await getDb();
    db.run("DELETE FROM prompt_templates WHERE id = ?", [body.id]);
    return Response.json({ ok: true });
  } catch {
    return serverError("Failed to delete template");
  }
}
