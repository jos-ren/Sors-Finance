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
const PLAID_SYNC_WITH_SNAPSHOT_KEY = "PLAID_SYNC_WITH_SNAPSHOT";

/**
 * Get the configured snapshot time from the database (uses first found or default)
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
 * Check if snapshots are enabled for a specific user
 */
async function isSnapshotEnabledForUser(userId: number): Promise<boolean> {
  const result = await db
    .select()
    .from(schema.settings)
    .where(
      and(
        eq(schema.settings.key, SNAPSHOT_ENABLED_KEY),
        eq(schema.settings.userId, userId)
      )
    )
    .limit(1);

  // Default to true if no setting exists
  return result[0]?.value !== "false";
}

/**
 * Check if Plaid sync is enabled for a specific user
 * When enabled, Plaid balances will sync before creating portfolio snapshots
 */
async function isPlaidSyncEnabledForUser(userId: number): Promise<boolean> {
  const result = await db
    .select()
    .from(schema.settings)
    .where(
      and(
        eq(schema.settings.key, PLAID_SYNC_WITH_SNAPSHOT_KEY),
        eq(schema.settings.userId, userId)
      )
    )
    .limit(1);

  // Default to false if no setting exists (opt-in model)
  return result[0]?.value === "true";
}

/**
 * Sync Plaid balances for a specific user
 */
async function syncPlaidBalancesForUser(userId: number): Promise<{ success: boolean; accountsUpdated: number; errors: string[] }> {
  try {
    // Import dynamically to avoid circular dependencies
    const { db: dbInstance } = await import("./db/connection");
    const { plaidItems, plaidAccounts, portfolioItems } = await import("./db/schema");
    const { eq, and } = await import("drizzle-orm");
    const { createPlaidClient, isPlaidConfigured } = await import("./plaid/client");

    // Check if Plaid is configured
    if (!isPlaidConfigured()) {
      return { success: true, accountsUpdated: 0, errors: ["Plaid credentials not configured in environment variables"] };
    }

    // Get all Plaid items for this user
    const userPlaidItems = await dbInstance
      .select()
      .from(plaidItems)
      .where(eq(plaidItems.userId, userId));

    if (userPlaidItems.length === 0) {
      return { success: true, accountsUpdated: 0, errors: [] };
    }

    let accountsUpdated = 0;
    const errors: string[] = [];

    // Process each Plaid item
    for (const item of userPlaidItems) {
      try {
        // Use access token directly
        const accessToken = item.accessToken;

        // Create Plaid client from environment variables
        const client = createPlaidClient(item.environment as "sandbox" | "development" | "production");

        // Fetch balances
        const balanceResponse = await client.accountsBalanceGet({
          access_token: accessToken,
        });

        // Get Plaid accounts linked to portfolio accounts
        const linkedAccounts = await dbInstance
          .select({
            plaidAccount: plaidAccounts,
            portfolioItem: portfolioItems,
          })
          .from(plaidAccounts)
          .innerJoin(
            portfolioItems,
            eq(plaidAccounts.portfolioAccountId, portfolioItems.accountId)
          )
          .where(
            and(
              eq(plaidAccounts.plaidItemId, item.id),
              eq(plaidAccounts.userId, userId)
            )
          );

        // Update portfolio items with current balances
        for (const account of balanceResponse.data.accounts) {
          const linkedAccount = linkedAccounts.find(
            (la) => la.plaidAccount.accountId === account.account_id
          );

          if (linkedAccount) {
            const balance = account.balances.current || 0;

            // Update portfolio item
            await dbInstance
              .update(portfolioItems)
              .set({
                currentValue: balance,
                updatedAt: new Date(),
              })
              .where(eq(portfolioItems.id, linkedAccount.portfolioItem.id));

            accountsUpdated++;
          }
        }

        // Update item last sync timestamp
        await dbInstance
          .update(plaidItems)
          .set({
            lastSync: new Date(),
            status: "active",
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(plaidItems.id, item.id));
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error_message?: string } }; message?: string };
        const errorMessage = err?.response?.data?.error_message || err.message || "Unknown error";
        errors.push(`${item.institutionName}: ${errorMessage}`);

        // Update item status
        await dbInstance
          .update(plaidItems)
          .set({
            status: "error",
            errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(plaidItems.id, item.id));
      }
    }

    return { success: errors.length === 0, accountsUpdated, errors };
  } catch (error: unknown) {
    console.error(`[Scheduler] Plaid sync error for user #${userId}:`, error);
    const err = error as { message?: string };
    return { success: false, accountsUpdated: 0, errors: [err.message || "Unknown error"] };
  }
}

/**
 * Check if a snapshot already exists for today for a specific user
 */
async function hasSnapshotTodayForUser(userId: number): Promise<boolean> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const result = await db
    .select()
    .from(schema.portfolioSnapshots)
    .where(
      and(
        eq(schema.portfolioSnapshots.userId, userId),
        gte(schema.portfolioSnapshots.date, startOfDay),
        lte(schema.portfolioSnapshots.date, endOfDay)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Create a portfolio snapshot for a specific user
 */
async function createSnapshotForUser(userId: number): Promise<number> {
  const now = new Date();

  // Get accounts and active items for this specific user
  const accounts = await db
    .select()
    .from(schema.portfolioAccounts)
    .where(eq(schema.portfolioAccounts.userId, userId));
  const items = await db
    .select()
    .from(schema.portfolioItems)
    .where(
      and(
        eq(schema.portfolioItems.userId, userId),
        eq(schema.portfolioItems.isActive, true)
      )
    );

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
      userId,
      createdAt: now,
    })
    .returning({ id: schema.portfolioSnapshots.id });

  return result[0].id;
}

/**
 * Run the scheduled snapshot task for all users
 */
async function runSnapshotTask() {
  console.log("[Scheduler] Running scheduled portfolio snapshots for all users...");

  try {
    // Get all users
    const allUsers = await db.select().from(schema.users);

    if (allUsers.length === 0) {
      console.log("[Scheduler] No users found, skipping.");
      return;
    }

    console.log(`[Scheduler] Processing ${allUsers.length} user(s)...`);

    // Process each user
    for (const user of allUsers) {
      try {
        // Step 1: Sync Plaid balances if enabled
        const plaidSyncEnabled = await isPlaidSyncEnabledForUser(user.id);
        if (plaidSyncEnabled) {
          console.log(`[Scheduler] Syncing Plaid balances for user #${user.id} (${user.username})...`);
          const syncResult = await syncPlaidBalancesForUser(user.id);
          if (syncResult.accountsUpdated > 0) {
            console.log(`[Scheduler] Synced ${syncResult.accountsUpdated} account(s) for user #${user.id}`);
          }
          if (syncResult.errors.length > 0) {
            console.error(`[Scheduler] Plaid sync errors for user #${user.id}:`, syncResult.errors);
          }
        } else {
          console.log(`[Scheduler] Plaid sync disabled for user #${user.id} (${user.username}), skipping.`);
        }

        // Step 2: Create portfolio snapshot if enabled
        const snapshotEnabled = await isSnapshotEnabledForUser(user.id);
        if (!snapshotEnabled) {
          console.log(`[Scheduler] Snapshots disabled for user #${user.id} (${user.username}), skipping.`);
          continue;
        }

        // Check if snapshot already exists today for this user
        const exists = await hasSnapshotTodayForUser(user.id);
        if (exists) {
          console.log(`[Scheduler] Snapshot already exists for user #${user.id} (${user.username}), skipping.`);
          continue;
        }

        // Create snapshot for this user
        const snapshotId = await createSnapshotForUser(user.id);
        console.log(`[Scheduler] Created snapshot #${snapshotId} for user #${user.id} (${user.username})`);
      } catch (userError) {
        console.error(`[Scheduler] Failed to process user #${user.id}:`, userError);
        // Continue with other users even if one fails
      }
    }

    console.log("[Scheduler] Completed processing for all users.");
  } catch (error) {
    console.error("[Scheduler] Failed to run snapshot task:", error);
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
 * Manually trigger a snapshot for a specific user
 * @param userId - The user ID to create a snapshot for
 * @returns The snapshot ID if created, null if already exists
 */
export async function triggerSnapshot(userId: number): Promise<number | null> {
  console.log(`[Scheduler] Manually triggering snapshot for user #${userId}...`);

  try {
    const exists = await hasSnapshotTodayForUser(userId);
    if (exists) {
      console.log(`[Scheduler] Snapshot already exists for user #${userId} today.`);
      return null;
    }

    const snapshotId = await createSnapshotForUser(userId);
    console.log(`[Scheduler] Created snapshot #${snapshotId} for user #${userId}`);
    return snapshotId;
  } catch (error) {
    console.error(`[Scheduler] Failed to create snapshot for user #${userId}:`, error);
    throw error;
  }
}

/**
 * Manually trigger snapshots for all users
 * @returns Array of snapshot IDs created (excludes users who already had snapshots)
 */
export async function triggerSnapshotForAllUsers(): Promise<number[]> {
  console.log("[Scheduler] Manually triggering snapshots for all users...");

  const createdSnapshots: number[] = [];

  try {
    const allUsers = await db.select().from(schema.users);

    if (allUsers.length === 0) {
      console.log("[Scheduler] No users found.");
      return createdSnapshots;
    }

    for (const user of allUsers) {
      try {
        const exists = await hasSnapshotTodayForUser(user.id);
        if (exists) {
          console.log(`[Scheduler] Snapshot already exists for user #${user.id} (${user.username}), skipping.`);
          continue;
        }

        const snapshotId = await createSnapshotForUser(user.id);
        console.log(`[Scheduler] Created snapshot #${snapshotId} for user #${user.id} (${user.username})`);
        createdSnapshots.push(snapshotId);
      } catch (userError) {
        console.error(`[Scheduler] Failed to create snapshot for user #${user.id}:`, userError);
        // Continue with other users even if one fails
      }
    }

    console.log(`[Scheduler] Completed. Created ${createdSnapshots.length} snapshot(s).`);
    return createdSnapshots;
  } catch (error) {
    console.error("[Scheduler] Failed to trigger snapshots:", error);
    throw error;
  }
}
