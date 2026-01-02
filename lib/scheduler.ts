/**
 * Scheduler Module
 *
 * Handles scheduled tasks like automatic portfolio snapshots.
 * Uses node-cron for scheduling and reads configuration from the database.
 */

import cron, { ScheduledTask } from "node-cron";
import { db, schema } from "./db/connection";
import { eq, and, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";

let schedulerInitialized = false;
let currentJob: ScheduledTask | null = null;

const SNAPSHOT_TIME_KEY = "SNAPSHOT_TIME";
const SNAPSHOT_ENABLED_KEY = "SNAPSHOT_ENABLED";

/**
 * Get the configured snapshot time from the database
 */
async function getSnapshotTime(): Promise<string> {
  const result = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, SNAPSHOT_TIME_KEY))
    .limit(1);

  return result[0]?.value || "03:00";
}

/**
 * Check if snapshots are enabled
 */
async function isSnapshotEnabled(): Promise<boolean> {
  const result = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, SNAPSHOT_ENABLED_KEY))
    .limit(1);

  return result[0]?.value !== "false";
}

/**
 * Check if a snapshot already exists for today
 */
async function hasSnapshotToday(): Promise<boolean> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const result = await db
    .select()
    .from(schema.portfolioSnapshots)
    .where(
      and(
        gte(schema.portfolioSnapshots.date, startOfDay),
        lte(schema.portfolioSnapshots.date, endOfDay)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Create a portfolio snapshot
 */
async function createSnapshot(): Promise<number> {
  const now = new Date();

  // Get all accounts and active items
  const accounts = await db.select().from(schema.portfolioAccounts);
  const items = await db
    .select()
    .from(schema.portfolioItems)
    .where(eq(schema.portfolioItems.isActive, true));

  // Calculate totals
  let totalSavings = 0;
  let totalInvestments = 0;
  let totalAssets = 0;
  let totalDebt = 0;

  const accountDetails: Array<{ id: number; bucket: string; name: string; total: number }> = [];
  const itemDetails: Array<{ id: number; accountId: number; name: string; value: number }> = [];

  for (const account of accounts) {
    const accountItems = items.filter((i) => i.accountId === account.id);
    const accountTotal = accountItems.reduce((sum, i) => sum + i.currentValue, 0);

    accountDetails.push({
      id: account.id,
      bucket: account.bucket,
      name: account.name,
      total: accountTotal,
    });

    for (const item of accountItems) {
      itemDetails.push({
        id: item.id,
        accountId: item.accountId,
        name: item.name,
        value: item.currentValue,
      });
    }

    switch (account.bucket) {
      case "Savings":
        totalSavings += accountTotal;
        break;
      case "Investments":
        totalInvestments += accountTotal;
        break;
      case "Assets":
        totalAssets += accountTotal;
        break;
      case "Debt":
        totalDebt += accountTotal;
        break;
    }
  }

  const netWorth = totalSavings + totalInvestments + totalAssets - totalDebt;

  const result = await db
    .insert(schema.portfolioSnapshots)
    .values({
      uuid: randomUUID(),
      date: now,
      totalSavings,
      totalInvestments,
      totalAssets,
      totalDebt,
      netWorth,
      details: {
        accounts: accountDetails,
        items: itemDetails,
      },
      createdAt: now,
    })
    .returning({ id: schema.portfolioSnapshots.id });

  return result[0].id;
}

/**
 * Run the scheduled snapshot task
 */
async function runSnapshotTask() {
  console.log("[Scheduler] Running scheduled portfolio snapshot...");

  try {
    // Check if enabled
    const enabled = await isSnapshotEnabled();
    if (!enabled) {
      console.log("[Scheduler] Snapshots are disabled, skipping.");
      return;
    }

    // Check if already exists today
    const exists = await hasSnapshotToday();
    if (exists) {
      console.log("[Scheduler] Snapshot already exists for today, skipping.");
      return;
    }

    // Create snapshot
    const snapshotId = await createSnapshot();
    console.log(`[Scheduler] Created snapshot #${snapshotId}`);
  } catch (error) {
    console.error("[Scheduler] Failed to create snapshot:", error);
  }
}

/**
 * Convert time string (HH:MM) to cron expression
 */
function timeToCron(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  return `${minutes} ${hours} * * *`;
}

/**
 * Initialize the scheduler
 */
export async function initScheduler() {
  if (schedulerInitialized) {
    console.log("[Scheduler] Already initialized");
    return;
  }

  // Only run in production
  if (process.env.NODE_ENV !== "production") {
    console.log("[Scheduler] Skipping initialization in development mode");
    return;
  }

  try {
    const snapshotTime = await getSnapshotTime();
    const cronExpression = timeToCron(snapshotTime);

    console.log(`[Scheduler] Initializing with snapshot time: ${snapshotTime} (cron: ${cronExpression})`);

    currentJob = cron.schedule(cronExpression, runSnapshotTask);

    schedulerInitialized = true;
    console.log("[Scheduler] Initialized successfully");
  } catch (error) {
    console.error("[Scheduler] Failed to initialize:", error);
  }
}

/**
 * Update the scheduler with a new time
 */
export async function updateSchedulerTime(newTime: string) {
  if (currentJob) {
    currentJob.stop();
    currentJob = null;
  }

  const cronExpression = timeToCron(newTime);
  console.log(`[Scheduler] Updating snapshot time to: ${newTime} (cron: ${cronExpression})`);

  currentJob = cron.schedule(cronExpression, runSnapshotTask);
}

/**
 * Stop the scheduler
 */
export function stopScheduler() {
  if (currentJob) {
    currentJob.stop();
    currentJob = null;
    schedulerInitialized = false;
    console.log("[Scheduler] Stopped");
  }
}

/**
 * Manually trigger a snapshot (for testing or manual runs)
 */
export async function triggerSnapshot(): Promise<number | null> {
  console.log("[Scheduler] Manually triggering snapshot...");

  try {
    const exists = await hasSnapshotToday();
    if (exists) {
      console.log("[Scheduler] Snapshot already exists for today.");
      return null;
    }

    const snapshotId = await createSnapshot();
    console.log(`[Scheduler] Created snapshot #${snapshotId}`);
    return snapshotId;
  } catch (error) {
    console.error("[Scheduler] Failed to create snapshot:", error);
    throw error;
  }
}
