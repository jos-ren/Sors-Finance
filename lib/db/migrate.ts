/**
 * Database Migration Runner
 *
 * Runs Drizzle migrations on application startup.
 */

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./connection";
import path from "path";

export async function runMigrations() {
  console.log("[DB] Running migrations...");

  try {
    migrate(db, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    console.log("[DB] Migrations complete");
  } catch (error) {
    console.error("[DB] Migration failed:", error);
    throw error;
  }
}
