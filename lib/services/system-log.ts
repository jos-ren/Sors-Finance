/**
 * System Log Service
 *
 * Persists scheduler runs, sync failures, and integration errors to the
 * system_logs table so users can review them in Settings → Error Log.
 * Writing a log entry must never break the operation being logged, so
 * every helper swallows its own failures.
 */

import { db, schema } from "@/lib/db/connection";
import { lt } from "drizzle-orm";

export type SystemLogLevel = "info" | "warning" | "error";

export type SystemLogSource =
  | "scheduler"
  | "plaid_sync"
  | "price_refresh"
  | "snapshot"
  | "currency_cache";

export interface SystemLogEntry {
  level: SystemLogLevel;
  source: SystemLogSource;
  message: string;
  details?: Record<string, unknown>;
  userId?: number;
}

/** Keep logs for 90 days by default */
const DEFAULT_RETENTION_DAYS = 90;

export async function logSystemEvent(entry: SystemLogEntry): Promise<void> {
  try {
    await db.insert(schema.systemLogs).values({
      level: entry.level,
      source: entry.source,
      message: entry.message,
      details: entry.details,
      userId: entry.userId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("[SystemLog] Failed to write log entry:", error, entry);
  }
}

/**
 * Delete log entries older than the retention window.
 * Called at the start of each scheduled run to keep the table bounded.
 */
export async function pruneSystemLogs(
  retentionDays: number = DEFAULT_RETENTION_DAYS
): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    await db
      .delete(schema.systemLogs)
      .where(lt(schema.systemLogs.createdAt, cutoff));
  } catch (error) {
    console.error("[SystemLog] Failed to prune old log entries:", error);
  }
}
