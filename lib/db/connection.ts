/**
 * Database Connection
 *
 * SQLite connection using better-sqlite3 and Drizzle ORM.
 * This replaces the Dexie instance for server-side database operations.
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Ensure data directory exists
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "sors.db");

// Create SQLite connection
const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrent performance
sqlite.pragma("journal_mode = WAL");

// Enable foreign key constraints
sqlite.pragma("foreign_keys = ON");

// Create Drizzle instance with schema
export const db = drizzle(sqlite, { schema });

// Export schema for use in queries
export { schema };

// Export the raw SQLite instance for direct access if needed
export { sqlite };
