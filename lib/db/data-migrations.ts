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
import { migrateCollapseBudgetItems } from "./migrate-collapse-budget-items";
import path from "path";

const HIERARCHY_MARKER = "budget_hierarchy_v1";
const COLLAPSE_ITEMS_MARKER = "budget_hierarchy_v2_collapse_items";

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
 * Run all pending TS data migrations in order. Each is idempotent and
 * independently guarded by its own marker, so later migrations still run
 * even when earlier ones were already applied in a prior deploy.
 * Called from runMigrations() after SQL migrations succeed.
 */
export async function runDataMigrations(): Promise<void> {
  await runHierarchyMigration();
  await runCollapseBudgetItemsMigration();
}

async function runHierarchyMigration(): Promise<void> {
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

async function runCollapseBudgetItemsMigration(): Promise<void> {
  if (markerApplied(COLLAPSE_ITEMS_MARKER)) return;

  if (!tableExists("budget_items_legacy")) {
    setMarker(COLLAPSE_ITEMS_MARKER);
    return;
  }

  console.log("[DB] Running data migration: budget_hierarchy_v2_collapse_items");

  try {
    const dbPath = path.join(process.cwd(), "data", "sors.db");
    await sqlite.backup(`${dbPath}.pre-collapse-items.bak`);
    console.log("[DB] Backed up database to data/sors.db.pre-collapse-items.bak");
  } catch (err) {
    console.error("[DB] Backup before collapse-items migration failed:", err);
    throw err;
  }

  migrateCollapseBudgetItems(sqlite);
  setMarker(COLLAPSE_ITEMS_MARKER);

  console.log("[DB] Data migration complete: budget_hierarchy_v2_collapse_items");
}
