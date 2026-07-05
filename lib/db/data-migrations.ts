/**
 * TS Data Migrations — orchestration.
 *
 * One-off data transformations that can't be expressed as pure SQL migrations.
 * Each is guarded by a marker row in `data_migrations` so it runs exactly once,
 * independently of the drizzle SQL journal. Called from runMigrations() after
 * the SQL migrations have applied. The transform logic lives in dedicated
 * dependency-injected modules (e.g. ./migrate-budget-hierarchy) so it can be
 * tested against a scratch database.
 */

import { sqlite } from "./connection";
import { migrateBudgetHierarchy } from "./migrate-budget-hierarchy";
import path from "path";

const HIERARCHY_MARKER = "budget_hierarchy_v1";

function markerApplied(name: string): boolean {
  const row = sqlite.prepare("SELECT 1 FROM data_migrations WHERE name = ?").get(name);
  return !!row;
}

function setMarker(name: string): void {
  sqlite
    .prepare("INSERT OR IGNORE INTO data_migrations (name, applied_at) VALUES (?, ?)")
    .run(name, Date.now());
}

function tableExists(name: string): boolean {
  const row = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?")
    .get(name);
  return !!row;
}

/**
 * Run all pending TS data migrations. Idempotent — each is guarded by a marker.
 * Called from runMigrations() after SQL migrations succeed.
 */
export async function runDataMigrations(): Promise<void> {
  if (markerApplied(HIERARCHY_MARKER)) return;

  // Nothing to migrate if the SQL migration hasn't created budgets_legacy yet.
  if (!tableExists("budgets_legacy")) {
    setMarker(HIERARCHY_MARKER);
    return;
  }

  console.log("[DB] Running data migration: budget_hierarchy_v1");

  // Back up the DB before a structural data migration.
  try {
    const dbPath = path.join(process.cwd(), "data", "sors.db");
    await sqlite.backup(`${dbPath}.pre-hierarchy.bak`);
    console.log("[DB] Backed up database to data/sors.db.pre-hierarchy.bak");
  } catch (err) {
    console.error("[DB] Backup before hierarchy migration failed:", err);
    throw err;
  }

  migrateBudgetHierarchy(sqlite);
  setMarker(HIERARCHY_MARKER);

  console.log("[DB] Data migration complete: budget_hierarchy_v1");
}
