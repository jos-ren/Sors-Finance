/**
 * keyword_match_modes_v1 — core data migration (dependency-injected DB).
 *
 * Converts every category/subcategory `keywords` column from `string[]` to
 * `Array<{ text, mode }>`, defaulting existing keywords to `mode: "contains"`
 * (the only mode that previously existed). Idempotent: rows already holding
 * object-shaped keywords are left untouched.
 */

import type BetterSqlite3 from "better-sqlite3";

type DB = BetterSqlite3.Database;

function toKeywordObjects(raw: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    return "[]";
  }
  if (!Array.isArray(parsed)) return "[]";

  const out = parsed.map((entry) => {
    if (typeof entry === "string") return { text: entry, mode: "contains" as const };
    if (entry && typeof entry === "object" && typeof (entry as { text?: unknown }).text === "string") {
      const mode = (entry as { mode?: unknown }).mode;
      return {
        text: (entry as { text: string }).text,
        mode: mode === "startsWith" || mode === "exact" ? mode : "contains",
      };
    }
    return null;
  });

  return JSON.stringify(out.filter((k): k is { text: string; mode: string } => k !== null));
}

export function migrateKeywordModes(sqlite: DB): void {
  const now = Date.now();

  for (const tableName of ["categories", "budget_subcategories"]) {
    const rows = sqlite.prepare(`SELECT id, keywords FROM ${tableName}`).all() as {
      id: number;
      keywords: string;
    }[];
    const update = sqlite.prepare(`UPDATE ${tableName} SET keywords = ?, updated_at = ? WHERE id = ?`);
    for (const row of rows) {
      const converted = toKeywordObjects(row.keywords);
      if (converted !== row.keywords) {
        update.run(converted, now, row.id);
      }
    }
  }
}
