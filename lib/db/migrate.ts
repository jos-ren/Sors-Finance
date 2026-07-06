/**
 * Database Migration Runner
 *
 * Runs Drizzle migrations on application startup.
 */

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./connection";
import { sqlite } from "./connection";
import { runDataMigrations } from "./data-migrations";
import path from "path";

export async function runMigrations() {
  console.log("[DB] Running migrations...");

  try {
    // Disable foreign keys during migration so table creation order doesn't matter
    sqlite.pragma("foreign_keys = OFF");

    migrate(db, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });

    // Re-enable foreign keys after migration
    sqlite.pragma("foreign_keys = ON");

    console.log("[DB] Migrations complete");

    // Run one-off TS data migrations (idempotent, guarded by markers).
    // Runs with foreign keys ON so cascade/set-null behaviour applies.
    await runDataMigrations();
  } catch (error) {
    // Re-enable foreign keys even on failure
    sqlite.pragma("foreign_keys = ON");
    console.error("[DB] Migration failed:", error);
    throw error;
  }
}
