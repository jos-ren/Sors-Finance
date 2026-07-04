/**
 * Scheduler Module
 *
 * Handles scheduled tasks like automatic portfolio snapshots.
 * Uses node-cron for scheduling and reads configuration from the database.
 *
 * Price lookups call the quote services in lib/services/quotes directly —
 * background jobs have no session cookie, so fetching our own API routes
 * over HTTP would be rejected by the auth middleware with 401.
 *
 * Failures are recorded to the system_logs table (Settings → Error Log).
 */

import cron, { ScheduledTask } from "node-cron";
import { db, schema } from "@/lib/db/connection";
import { eq, and, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createPlaidClient, isPlaidConfigured } from "@/lib/plaid/client";
import {
  getStockQuote,
  getCryptoQuote,
  getMetalQuote,
  getExchangeRateValue,
  QuoteError,
} from "./quotes";
import { warmCurrencyCache } from "./currency-cache";
import { logSystemEvent, pruneSystemLogs } from "./system-log";

let schedulerInitialized = false;
let currentJob: ScheduledTask | null = null;

const SNAPSHOT_TIME_KEY = "SNAPSHOT_TIME";
const SNAPSHOT_ENABLED_KEY = "SNAPSHOT_ENABLED";
const PLAID_SYNC_WITH_SNAPSHOT_KEY = "PLAID_SYNC_WITH_SNAPSHOT";
const PRICE_REFRESH_WITH_SNAPSHOT_KEY = "PRICE_REFRESH_WITH_SNAPSHOT";
const TIMEZONE_KEY = "TIMEZONE";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Finnhub's free tier rate-limits per-minute; space out stock lookups so a
// portfolio with several tickers doesn't get 429'd mid-batch.
const STOCK_LOOKUP_DELAY_MS = 1100;

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
 * Get the configured timezone (uses first found). The snapshot time is
 * interpreted in this timezone; without it, node-cron uses the server's
 * local time — which inside Docker is usually UTC.
 */
async function getSnapshotTimezone(): Promise<string | undefined> {
  const result = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, TIMEZONE_KEY))
    .limit(1);

  return result[0]?.value || undefined;
}

/**
 * Read a per-user boolean setting, with a default when unset
 */
async function getUserBoolSetting(
  userId: number,
  key: string,
  defaultValue: boolean
): Promise<boolean> {
  const result = await db
    .select()
    .from(schema.settings)
    .where(
      and(eq(schema.settings.key, key), eq(schema.settings.userId, userId))
    )
    .limit(1);

  if (result.length === 0) return defaultValue;
  return result[0].value === "true";
}

const isSnapshotEnabledForUser = (userId: number) =>
  getUserBoolSetting(userId, SNAPSHOT_ENABLED_KEY, true);

// Opt-in: default false
const isPlaidSyncEnabledForUser = (userId: number) =>
  getUserBoolSetting(userId, PLAID_SYNC_WITH_SNAPSHOT_KEY, false);

// Opt-out: default true
const isPriceRefreshEnabledForUser = (userId: number) =>
  getUserBoolSetting(userId, PRICE_REFRESH_WITH_SNAPSHOT_KEY, true);

/**
 * Get the user's preferred currency
 */
async function getUserCurrency(userId: number): Promise<string> {
  const result = await db
    .select()
    .from(schema.settings)
    .where(
      and(
        eq(schema.settings.key, "CURRENCY"),
        eq(schema.settings.userId, userId)
      )
    )
    .limit(1);

  return result[0]?.value || "CAD";
}

/**
 * Sync Plaid balances for a specific user
 */
async function syncPlaidBalancesForUser(
  userId: number
): Promise<{ success: boolean; accountsUpdated: number; errors: string[] }> {
  try {
    // Check if Plaid is configured
    if (!isPlaidConfigured()) {
      return {
        success: true,
        accountsUpdated: 0,
        errors: ["Plaid credentials not configured in environment variables"],
      };
    }

    // Get all Plaid items for this user
    const userPlaidItems = await db
      .select()
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.userId, userId));

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
        const client = createPlaidClient(
          item.environment as "sandbox" | "development" | "production"
        );

        // Fetch balances
        const balanceResponse = await client.accountsBalanceGet({
          access_token: accessToken,
        });

        // Get Plaid accounts linked to portfolio accounts
        const linkedAccounts = await db
          .select({
            plaidAccount: schema.plaidAccounts,
            portfolioItem: schema.portfolioItems,
          })
          .from(schema.plaidAccounts)
          .innerJoin(
            schema.portfolioItems,
            eq(schema.plaidAccounts.portfolioAccountId, schema.portfolioItems.accountId)
          )
          .where(
            and(
              eq(schema.plaidAccounts.plaidItemId, item.id),
              eq(schema.plaidAccounts.userId, userId)
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
            await db
              .update(schema.portfolioItems)
              .set({
                currentValue: balance,
                updatedAt: new Date(),
              })
              .where(eq(schema.portfolioItems.id, linkedAccount.portfolioItem.id));

            accountsUpdated++;
          }
        }

        // Update item last sync timestamp
        await db
          .update(schema.plaidItems)
          .set({
            lastSync: new Date(),
            status: "active",
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.plaidItems.id, item.id));
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error_message?: string } }; message?: string };
        const errorMessage = err?.response?.data?.error_message || err.message || "Unknown error";
        errors.push(`${item.institutionName}: ${errorMessage}`);

        // Update item status
        await db
          .update(schema.plaidItems)
          .set({
            status: "error",
            errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(schema.plaidItems.id, item.id));
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
 * Refresh ticker prices for a specific user by calling the quote services
 * directly (no HTTP self-fetch).
 */
async function refreshTickerPricesForUser(
  userId: number,
  userCurrency: string
): Promise<{ success: boolean; updated: number; failed: Array<{ ticker: string; itemName: string; error: string }> }> {
  try {
    // Get ticker items for this user
    const items = await db
      .select()
      .from(schema.portfolioItems)
      .where(
        and(
          eq(schema.portfolioItems.userId, userId),
          eq(schema.portfolioItems.isActive, true),
          eq(schema.portfolioItems.priceMode, "ticker")
        )
      );

    if (items.length === 0) {
      return { success: true, updated: 0, failed: [] };
    }

    // Get unique tickers to avoid duplicate API calls, but preserve tickerType
    const tickerMap = new Map<string, string>(); // ticker -> tickerType
    for (const item of items) {
      if (item.ticker) {
        const upperTicker = item.ticker.toUpperCase();
        // Use the first tickerType we find for each unique ticker
        if (!tickerMap.has(upperTicker)) {
          tickerMap.set(upperTicker, item.type || item.tickerType || "stock");
        }
      }
    }
    const uniqueTickers = Array.from(tickerMap.keys());

    // First pass: fetch unique ticker prices
    const tickerQuotes = new Map<
      string,
      { quote: { price: number; currency: string; name?: string } | null; error?: string }
    >();

    let stockLookupCount = 0;

    for (const ticker of uniqueTickers) {
      const tickerType = tickerMap.get(ticker) || "stock";

      // Clean crypto ticker (remove exchange prefix like "BINANCE:")
      let cleanTicker = ticker;
      if (tickerType === "crypto" && ticker.includes(":")) {
        cleanTicker = ticker.split(":")[1] || ticker;
      }

      try {
        let quote = null;

        if (tickerType === "metal") {
          quote = await getMetalQuote(cleanTicker);
        } else if (tickerType === "crypto") {
          quote = await getCryptoQuote(cleanTicker);
        } else {
          // Space out Finnhub-backed stock lookups to avoid tripping its rate limit
          if (stockLookupCount > 0) {
            await sleep(STOCK_LOOKUP_DELAY_MS);
          }
          stockLookupCount++;

          try {
            quote = await getStockQuote(cleanTicker);
          } catch (error) {
            if (error instanceof QuoteError && error.code === "RATE_LIMIT") {
              // Retry once after backing off — Finnhub's per-minute limit resets quickly
              await sleep(STOCK_LOOKUP_DELAY_MS * 2);
              quote = await getStockQuote(cleanTicker);
            } else {
              throw error;
            }
          }
        }

        tickerQuotes.set(ticker, { quote });
      } catch (error) {
        const message =
          error instanceof QuoteError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unknown error";
        tickerQuotes.set(ticker, { quote: null, error: message });
      }
    }

    // Second pass: update all items using cached quotes
    const failed: Array<{ ticker: string; itemName: string; error: string }> = [];
    let updated = 0;

    for (const item of items) {
      if (!item.ticker) continue;

      const upperTicker = item.ticker.toUpperCase();
      const cached = tickerQuotes.get(upperTicker);

      if (!cached || !cached.quote) {
        failed.push({
          ticker: item.ticker,
          itemName: item.name,
          error: cached?.error || 'Ticker not found'
        });
        continue;
      }

      const { quote } = cached;

      // Use item's existing currency if user manually set it, otherwise use quote's currency
      const effectiveCurrency = (item.currency && item.currency.trim()) ? item.currency : quote.currency;

      // Get exchange rate based on the effective currency (user's or API's)
      let exchangeRate = 1;
      if (effectiveCurrency !== userCurrency) {
        exchangeRate = await getExchangeRateValue(effectiveCurrency, userCurrency);
      }

      // Calculate new value using the correct exchange rate
      const newValue = (item.quantity || 0) * quote.price * exchangeRate;

      // Update the item - preserve user-set currency
      await db
        .update(schema.portfolioItems)
        .set({
          pricePerUnit: quote.price,
          currency: effectiveCurrency,
          currentValue: newValue,
          lastPriceUpdate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.portfolioItems.id, item.id!));

      updated++;
    }

    return {
      success: failed.length === 0,
      updated,
      failed
    };
  } catch (error: unknown) {
    console.error(`[Scheduler] Price refresh error for user #${userId}:`, error);
    const err = error as { message?: string };
    return { success: false, updated: 0, failed: [{ ticker: "N/A", itemName: "N/A", error: err.message || "Unknown error" }] };
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
  const runStart = Date.now();

  // Keep the error log table bounded
  await pruneSystemLogs();

  const summary = {
    usersProcessed: 0,
    snapshotsCreated: 0,
    snapshotsUpdated: 0,
    plaidAccountsUpdated: 0,
    tickersRefreshed: 0,
    errorCount: 0,
  };

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
        summary.usersProcessed++;
        const userCurrency = await getUserCurrency(user.id);

        const plaidSyncEnabled = await isPlaidSyncEnabledForUser(user.id);
        const priceRefreshEnabled = await isPriceRefreshEnabledForUser(user.id);

        // Pre-warm currency cache before any syncing
        if (plaidSyncEnabled || priceRefreshEnabled) {
          try {
            const cacheResult = await warmCurrencyCache(user.id);
            console.log(`[Scheduler] Currency cache warmed for user #${user.id}: ${cacheResult.refreshed} rates refreshed`);
            if (cacheResult.failed > 0) {
              // A single rate miss falls back to 1 for that pair and retries
              // tomorrow — transient and not actionable, so console-only.
              console.warn(`[Scheduler] Failed to refresh ${cacheResult.failed} of ${cacheResult.pairs.length} exchange rate(s) for user #${user.id}`);
            }
          } catch (error) {
            console.error(`[Scheduler] Error warming currency cache for user #${user.id}:`, error);
            summary.errorCount++;
            await logSystemEvent({
              level: "error",
              source: "currency_cache",
              message: "Currency cache warming failed during scheduled snapshot",
              details: { error: error instanceof Error ? error.message : String(error) },
              userId: user.id,
            });
            // Continue anyway
          }
        }

        // Step 1: Sync Plaid balances if enabled
        if (plaidSyncEnabled) {
          console.log(`[Scheduler] Syncing Plaid balances for user #${user.id} (${user.username})...`);
          const syncResult = await syncPlaidBalancesForUser(user.id);
          summary.plaidAccountsUpdated += syncResult.accountsUpdated;
          if (syncResult.accountsUpdated > 0) {
            console.log(`[Scheduler] Synced ${syncResult.accountsUpdated} account(s) for user #${user.id}`);
          }
          if (syncResult.errors.length > 0) {
            console.error(`[Scheduler] Plaid sync errors for user #${user.id}:`, syncResult.errors);
            summary.errorCount += syncResult.errors.length;
            await logSystemEvent({
              level: "error",
              source: "plaid_sync",
              message: `Plaid sync failed for ${syncResult.errors.length} institution(s) during scheduled snapshot`,
              details: { errors: syncResult.errors, accountsUpdated: syncResult.accountsUpdated },
              userId: user.id,
            });
          }
        } else {
          console.log(`[Scheduler] Plaid sync disabled for user #${user.id} (${user.username}), skipping.`);
        }

        // Step 2: Refresh ticker prices if enabled
        if (priceRefreshEnabled) {
          console.log(`[Scheduler] Refreshing ticker prices for user #${user.id} (${user.username})...`);
          const refreshResult = await refreshTickerPricesForUser(user.id, userCurrency);
          summary.tickersRefreshed += refreshResult.updated;
          if (refreshResult.updated > 0) {
            console.log(`[Scheduler] Refreshed ${refreshResult.updated} ticker(s) for user #${user.id}`);
          }
          if (refreshResult.failed.length > 0) {
            console.error(`[Scheduler] Price refresh errors for user #${user.id}:`, refreshResult.failed);
            summary.errorCount += refreshResult.failed.length;
            await logSystemEvent({
              level: "error",
              source: "price_refresh",
              message: `Price refresh failed for ${refreshResult.failed.length} ticker(s) during scheduled snapshot`,
              details: { failed: refreshResult.failed, updated: refreshResult.updated },
              userId: user.id,
            });
          }
        } else {
          console.log(`[Scheduler] Price refresh disabled for user #${user.id} (${user.username}), skipping.`);
        }

        // Step 3: Create or update portfolio snapshot if enabled
        const snapshotEnabled = await isSnapshotEnabledForUser(user.id);
        if (!snapshotEnabled) {
          console.log(`[Scheduler] Snapshots disabled for user #${user.id} (${user.username}), skipping.`);
          continue;
        }

        // If prices were refreshed, always upsert today's snapshot so it captures fresh values.
        // Otherwise, only create if no snapshot exists today.
        const exists = await hasSnapshotTodayForUser(user.id);
        if (exists && !priceRefreshEnabled) {
          console.log(`[Scheduler] Snapshot already exists for user #${user.id} (${user.username}), skipping.`);
          continue;
        }

        if (exists) {
          // Update the existing today snapshot with latest portfolio values
          const now = new Date();
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

          const existingSnapshot = await db
            .select()
            .from(schema.portfolioSnapshots)
            .where(
              and(
                eq(schema.portfolioSnapshots.userId, user.id),
                gte(schema.portfolioSnapshots.date, startOfDay),
                lte(schema.portfolioSnapshots.date, endOfDay)
              )
            )
            .limit(1);

          if (existingSnapshot.length > 0) {
            // Re-calculate totals with fresh prices
            const accounts = await db
              .select()
              .from(schema.portfolioAccounts)
              .where(eq(schema.portfolioAccounts.userId, user.id));
            const items = await db
              .select()
              .from(schema.portfolioItems)
              .where(
                and(
                  eq(schema.portfolioItems.userId, user.id),
                  eq(schema.portfolioItems.isActive, true)
                )
              );

            let totalSavings = 0, totalInvestments = 0, totalAssets = 0, totalDebt = 0;
            for (const account of accounts) {
              const total = items.filter(i => i.accountId === account.id).reduce((s, i) => s + i.currentValue, 0);
              switch (account.bucket) {
                case "Savings": totalSavings += total; break;
                case "Investments": totalInvestments += total; break;
                case "Assets": totalAssets += total; break;
                case "Debt": totalDebt += total; break;
              }
            }
            const netWorth = totalSavings + totalInvestments + totalAssets - totalDebt;

            await db
              .update(schema.portfolioSnapshots)
              .set({ totalSavings, totalInvestments, totalAssets, totalDebt, netWorth })
              .where(eq(schema.portfolioSnapshots.id, existingSnapshot[0].id));

            summary.snapshotsUpdated++;
            console.log(`[Scheduler] Updated existing snapshot #${existingSnapshot[0].id} for user #${user.id} with refreshed prices.`);
          }
        } else {
          // Create snapshot for this user
          const snapshotId = await createSnapshotForUser(user.id);
          summary.snapshotsCreated++;
          console.log(`[Scheduler] Created snapshot #${snapshotId} for user #${user.id} (${user.username})`);
        }
      } catch (userError) {
        console.error(`[Scheduler] Failed to process user #${user.id}:`, userError);
        summary.errorCount++;
        await logSystemEvent({
          level: "error",
          source: "snapshot",
          message: "Scheduled snapshot failed",
          details: { error: userError instanceof Error ? userError.message : String(userError) },
          userId: user.id,
        });
        // Continue with other users even if one fails
      }
    }

    const durationMs = Date.now() - runStart;
    console.log(`[Scheduler] Completed processing for all users in ${durationMs}ms.`, summary);
    // No log entry on a clean or already-logged run — every failure above
    // is recorded at its source, so a blanket summary would just duplicate
    // (or, on success, pointlessly restate) what's already there.
  } catch (error) {
    console.error("[Scheduler] Failed to run snapshot task:", error);
    await logSystemEvent({
      level: "error",
      source: "scheduler",
      message: "Scheduled snapshot run failed",
      details: { error: error instanceof Error ? error.message : String(error) },
    });
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
 * Schedule the snapshot job, interpreting the time in the configured
 * timezone when one is set. Falls back to server-local time if the
 * timezone is invalid.
 */
function scheduleSnapshotJob(cronExpression: string, timezone?: string): ScheduledTask {
  if (timezone) {
    try {
      return cron.schedule(cronExpression, runSnapshotTask, { timezone });
    } catch (error) {
      console.error(`[Scheduler] Invalid timezone "${timezone}", falling back to server time:`, error);
    }
  }
  return cron.schedule(cronExpression, runSnapshotTask);
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
    const timezone = await getSnapshotTimezone();
    const cronExpression = timeToCron(snapshotTime);

    console.log(`[Scheduler] Initializing with snapshot time: ${snapshotTime} (cron: ${cronExpression}, timezone: ${timezone || "server default"})`);

    currentJob = scheduleSnapshotJob(cronExpression, timezone);

    schedulerInitialized = true;
    console.log("[Scheduler] Initialized successfully");
  } catch (error) {
    console.error("[Scheduler] Failed to initialize:", error);
    await logSystemEvent({
      level: "error",
      source: "scheduler",
      message: "Scheduler failed to initialize — automatic snapshots will not run",
      details: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}

/**
 * Update the scheduler with a new time
 */
export async function updateSchedulerTime(newTime: string) {
  // The scheduler only runs in production; don't start a job in dev
  if (process.env.NODE_ENV !== "production") {
    console.log("[Scheduler] Skipping reschedule in development mode");
    return;
  }

  if (currentJob) {
    currentJob.stop();
    currentJob = null;
  }

  const timezone = await getSnapshotTimezone();
  const cronExpression = timeToCron(newTime);
  console.log(`[Scheduler] Updating snapshot time to: ${newTime} (cron: ${cronExpression}, timezone: ${timezone || "server default"})`);

  currentJob = scheduleSnapshotJob(cronExpression, timezone);
  schedulerInitialized = true;
}

/**
 * Reschedule the snapshot job with the current time and timezone from the
 * database. Call after the TIMEZONE setting changes so the new timezone
 * takes effect without an app restart.
 */
export async function refreshScheduler() {
  if (process.env.NODE_ENV !== "production") return;

  const snapshotTime = await getSnapshotTime();
  await updateSchedulerTime(snapshotTime);
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
