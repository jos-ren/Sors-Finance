/**
 * API Route: Sync Plaid Balances
 * POST /api/plaid/balances/sync
 *
 * Fetches current balances for all user's Plaid accounts and updates linked portfolio items.
 * Can be triggered manually or by the scheduler.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-helper";
import { db } from "@/lib/db/connection";
import { plaidItems, plaidAccounts, portfolioItems, portfolioItemHistory, settings } from "@/lib/db/schema";
import type { HistoryChange } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createPlaidClient, isPlaidConfigured } from "@/lib/plaid/client";
import { PLAID_SETTINGS_KEYS } from "@/lib/plaid/types";
import {
  getStockQuote,
  getCryptoQuote,
  getMetalQuote,
  getExchangeRateValue,
  QuoteError,
} from "@/lib/services/quotes";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Finnhub's free tier rate-limits per-minute; space out stock lookups so a
// portfolio with several tickers doesn't get 429'd mid-batch.
const STOCK_LOOKUP_DELAY_MS = 1100;

/**
 * Build a comprehensive sync message
 */
function buildSyncMessage(result: {
  accountsUpdated: number;
  accountsFailed: number;
  pricesUpdated: number;
  pricesFailed: number;
}): string {
  const messages: string[] = [];
  
  if (result.accountsUpdated > 0) {
    messages.push(`${result.accountsUpdated} account${result.accountsUpdated !== 1 ? 's' : ''}`);
  }
  if (result.pricesUpdated > 0) {
    messages.push(`${result.pricesUpdated} price${result.pricesUpdated !== 1 ? 's' : ''}`);
  }
  
  if (messages.length === 0) {
    return "Nothing to sync";
  }
  
  let message = `Synced ${messages.join(' and ')}`;
  
  const failures: string[] = [];
  if (result.accountsFailed > 0) {
    failures.push(`${result.accountsFailed} account${result.accountsFailed !== 1 ? 's' : ''} failed`);
  }
  if (result.pricesFailed > 0) {
    failures.push(`${result.pricesFailed} price${result.pricesFailed !== 1 ? 's' : ''} failed`);
  }
  
  if (failures.length > 0) {
    message += `, but ${failures.join(' and ')}`;
  }
  
  return message;
}

/**
 * Refresh ticker prices for a specific user
 */
async function refreshTickerPricesForUser(
  userId: number,
  userCurrency: string
): Promise<{
  success: boolean;
  updated: number;
  failed: Array<{ ticker: string; itemName: string; error: string }>;
  synced: Array<{ ticker: string; itemName: string; price: number; currency: string }>;
}> {
  // Get ticker items for this user
  const items = await db
    .select()
    .from(portfolioItems)
    .where(
      and(
        eq(portfolioItems.userId, userId),
        eq(portfolioItems.isActive, true),
        eq(portfolioItems.priceMode, "ticker")
      )
    );

  if (items.length === 0) {
    return { success: true, updated: 0, failed: [], synced: [] };
  }

  // Get unique tickers to avoid duplicate API calls, but preserve tickerType
  const tickerMap = new Map<string, string>(); // ticker -> tickerType
  for (const item of items) {
    if (item.ticker) {
      const upperTicker = item.ticker.toUpperCase();
      if (!tickerMap.has(upperTicker)) {
        tickerMap.set(upperTicker, item.type || item.tickerType || "stock");
      }
    }
  }
  const uniqueTickers = Array.from(tickerMap.keys());

  // First pass: fetch unique ticker prices
  const tickerQuotes = new Map<
    string,
    {
      quote: { price: number; currency: string; name?: string } | null;
      exchangeRate: number;
      error?: string;
    }
  >();

  let stockLookupCount = 0;

  for (const ticker of uniqueTickers) {
    const tickerType = tickerMap.get(ticker) || "stock";

    try {
      let quote = null;
      let errorDetail = null;

      // Clean crypto ticker (remove exchange prefix like "BINANCE:")
      let cleanTicker = ticker;
      if (tickerType === "crypto" && ticker.includes(":")) {
        cleanTicker = ticker.split(":")[1] || ticker;
      }

      if (tickerType !== "metal" && tickerType !== "crypto") {
        // Space out Finnhub-backed stock lookups to avoid tripping its rate limit
        if (stockLookupCount > 0) {
          await sleep(STOCK_LOOKUP_DELAY_MS);
        }
        stockLookupCount++;
      }

      if (tickerType === "metal") {
        try {
          quote = await getMetalQuote(cleanTicker);
        } catch (error) {
          errorDetail = error instanceof QuoteError ? error.message : "Failed to fetch metal price";
          console.error(`[Price Refresh] Metal ${cleanTicker} failed:`, errorDetail);
        }
      } else if (tickerType === "crypto") {
        try {
          quote = await getCryptoQuote(cleanTicker);
        } catch (error) {
          errorDetail = error instanceof QuoteError ? error.message : "Failed to fetch crypto price";
          console.error(`[Price Refresh] Crypto ${cleanTicker} failed:`, errorDetail);
        }
      } else {
        // Stock lookup
        try {
          quote = await getStockQuote(cleanTicker);
        } catch (error) {
          if (error instanceof QuoteError && error.code === "RATE_LIMIT") {
            // Retry once after backing off further — Finnhub's per-minute limit resets quickly
            await sleep(STOCK_LOOKUP_DELAY_MS * 2);
            try {
              quote = await getStockQuote(cleanTicker);
            } catch (retryError) {
              errorDetail =
                retryError instanceof QuoteError ? retryError.message : "Failed to fetch stock data";
            }
          } else {
            errorDetail = error instanceof QuoteError ? error.message : "Failed to fetch stock data";
          }
          if (errorDetail) {
            console.error(`[Price Refresh] Stock ${cleanTicker} failed:`, errorDetail);
          }
        }
      }

      if (!quote) {
        tickerQuotes.set(ticker, { 
          quote: null, 
          exchangeRate: 1, 
          error: errorDetail || "Ticker not found" 
        });
      } else {
        // Get exchange rate if currency differs
        let exchangeRate = 1;
        if (quote.currency !== userCurrency) {
          exchangeRate = await getExchangeRateValue(quote.currency, userCurrency);
        }
        tickerQuotes.set(ticker, { quote, exchangeRate });
      }
    } catch (error) {
      tickerQuotes.set(ticker, {
        quote: null,
        exchangeRate: 1,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Second pass: update all items using cached quotes
  const failed: Array<{ ticker: string; itemName: string; error: string }> = [];
  const synced: Array<{ ticker: string; itemName: string; price: number; currency: string }> = [];
  let updated = 0;

  for (const item of items) {
    if (!item.ticker) continue;

    const upperTicker = item.ticker.toUpperCase();
    const cached = tickerQuotes.get(upperTicker);

    if (!cached || !cached.quote) {
      failed.push({
        ticker: item.ticker,
        itemName: item.name,
        error: cached?.error || "Ticker not found",
      });
      continue;
    }

    const { quote } = cached;

    // Use item's existing currency if user manually set it, otherwise use quote's currency
    const effectiveCurrency = item.currency && item.currency.trim() ? item.currency : quote.currency;

    // Get exchange rate based on the effective currency
    let exchangeRate = 1;
    if (effectiveCurrency !== userCurrency) {
      exchangeRate = await getExchangeRateValue(effectiveCurrency, userCurrency);
    }

    // Calculate new value using the correct exchange rate
    const newValue = (item.quantity || 0) * quote.price * exchangeRate;

    // Record history if price or value changed (sub-cent tolerance)
    const priceChanges: HistoryChange[] = [];
    if (Math.abs((item.pricePerUnit ?? 0) - quote.price) >= 0.005) {
      priceChanges.push({ field: "pricePerUnit", oldValue: item.pricePerUnit ?? null, newValue: quote.price });
    }
    if (Math.abs((item.currentValue ?? 0) - newValue) >= 0.005) {
      priceChanges.push({ field: "currentValue", oldValue: item.currentValue, newValue: newValue });
    }

    // Update the item
    await db
      .update(portfolioItems)
      .set({
        pricePerUnit: quote.price,
        currency: effectiveCurrency,
        currentValue: newValue,
        lastPriceUpdate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(portfolioItems.id, item.id!));

    if (priceChanges.length > 0) {
      await db.insert(portfolioItemHistory).values({
        itemId: item.id!,
        source: "price_refresh",
        type: item.type || item.tickerType || "stock",
        changes: priceChanges,
        userId,
        createdAt: new Date(),
      });
    }

    updated++;
    synced.push({
      ticker: item.ticker,
      itemName: item.name,
      price: quote.price,
      currency: effectiveCurrency,
    });
  }

  return { success: failed.length === 0, updated, failed, synced };
}

interface SyncResult {
  success: boolean;
  accountsUpdated: number;
  accountsFailed: number;
  pricesUpdated: number;
  pricesFailed: number;
  errors: string[];
  priceErrors: Array<{
    ticker: string;
    itemName: string;
    error: string;
  }>;
  syncedAccounts: Array<{
    accountId: string;
    name: string;
    balance: number;
  }>;
  syncedPrices: Array<{
    ticker: string;
    itemName: string;
    price: number;
    currency: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    // Check if Plaid is configured
    if (!isPlaidConfigured()) {
      return NextResponse.json(
        { error: "Plaid credentials not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET in your .env file." },
        { status: 400 }
      );
    }

    // Parse optional itemId from request body
    let itemId: number | undefined;
    try {
      const body = await request.json();
      itemId = body?.itemId;
    } catch {
      // No body or invalid JSON - sync all items
    }

    // Get Plaid items for this user (optionally filtered by itemId)
    const userPlaidItems = await db
      .select()
      .from(plaidItems)
      .where(
        itemId
          ? and(eq(plaidItems.userId, userId), eq(plaidItems.id, itemId))
          : eq(plaidItems.userId, userId)
      );

    if (userPlaidItems.length === 0) {
      return NextResponse.json({
        success: true,
        accountsUpdated: 0,
        accountsFailed: 0,
        errors: [],
        syncedAccounts: [],
        message: "No Plaid accounts connected",
      });
    }

    const result: SyncResult = {
      success: true,
      accountsUpdated: 0,
      accountsFailed: 0,
      pricesUpdated: 0,
      pricesFailed: 0,
      errors: [],
      priceErrors: [],
      syncedAccounts: [],
      syncedPrices: [],
    };

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

        // Get Plaid accounts for this item that are linked to portfolio items
        // Join directly via portfolioItems.plaidAccountId for 1-to-1 matching
        let linkedAccounts = await db
          .select({
            plaidAccount: plaidAccounts,
            portfolioItem: portfolioItems,
          })
          .from(plaidAccounts)
          .innerJoin(
            portfolioItems,
            eq(plaidAccounts.id, portfolioItems.plaidAccountId)
          )
          .where(
            and(
              eq(plaidAccounts.plaidItemId, item.id),
              eq(plaidAccounts.userId, userId)
            )
          );

        // Fallback: if no results, try joining through portfolio account
        if (linkedAccounts.length === 0) {
          linkedAccounts = await db
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
        }

        // Update portfolio items with current balances
        for (const account of balanceResponse.data.accounts) {
          const linkedAccount = linkedAccounts.find(
            (la) => la.plaidAccount.accountId === account.account_id
          );

          if (linkedAccount) {
            const balance = account.balances.current || 0;
            const oldValue = linkedAccount.portfolioItem.currentValue;

            // Update portfolio item balance and ensure plaidAccountId link is set
            await db
              .update(portfolioItems)
              .set({
                currentValue: balance,
                plaidAccountId: linkedAccount.plaidAccount.id,
                updatedAt: new Date(),
              })
              .where(eq(portfolioItems.id, linkedAccount.portfolioItem.id));

            // Record history if value changed (sub-cent tolerance)
            if (Math.abs((oldValue ?? 0) - balance) >= 0.005) {
              const changes: HistoryChange[] = [
                { field: "currentValue", oldValue: oldValue, newValue: balance },
              ];
              await db.insert(portfolioItemHistory).values({
                itemId: linkedAccount.portfolioItem.id,
                source: "plaid_sync",
                type: linkedAccount.portfolioItem.type || "bank",
                changes,
                userId,
                createdAt: new Date(),
              });
            }

            result.accountsUpdated++;
            result.syncedAccounts.push({
              accountId: account.account_id,
              name: linkedAccount.plaidAccount.name,
              balance,
            });
          }
        }

        // Update item last sync timestamp
        await db
          .update(plaidItems)
          .set({
            lastSync: new Date(),
            status: "active",
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(plaidItems.id, item.id));
      } catch (error: unknown) {
        result.accountsFailed++;
        const err = error as { response?: { data?: { error_message?: string } }; message?: string };
        const errorMessage = err?.response?.data?.error_message || err.message || "Unknown error";
        result.errors.push(`${item.institutionName}: ${errorMessage}`);

        // Update item status
        await db
          .update(plaidItems)
          .set({
            status: "error",
            errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(plaidItems.id, item.id));
      }
    }

    // Update last sync timestamp in settings
    const lastSyncSetting = await db
      .select()
      .from(settings)
      .where(
        and(
          eq(settings.userId, userId),
          eq(settings.key, PLAID_SETTINGS_KEYS.LAST_SYNC)
        )
      );

    const now = new Date();
    if (lastSyncSetting.length > 0) {
      await db
        .update(settings)
        .set({
          value: now.toISOString(),
        })
        .where(eq(settings.id, lastSyncSetting[0].id));
    } else {
      await db.insert(settings).values({
        userId,
        key: PLAID_SETTINGS_KEYS.LAST_SYNC,
        value: now.toISOString(),
      });
    }

    // After Plaid sync, refresh ticker prices — only when syncing ALL banks (no specific itemId)
    if (!itemId) {
      // Get user currency from settings
      const userCurrencySetting = await db
        .select()
        .from(settings)
        .where(and(eq(settings.userId, userId), eq(settings.key, "CURRENCY")))
        .limit(1);

      const userCurrency = userCurrencySetting[0]?.value || "CAD";

      // Pre-warm currency cache before price refresh
      try {
        const { warmCurrencyCache } = await import('@/lib/services/currency-cache');
        const cacheResult = await warmCurrencyCache(userId);
        console.log(`[Sync All] Currency cache warmed: ${cacheResult.refreshed} rates refreshed, ${cacheResult.failed} failed`);
      } catch (error) {
        console.error("Error warming currency cache:", error);
        // Continue even if cache warming fails
      }

      // Refresh ticker prices for all user's investment items
      try {
        const priceRefreshResult = await refreshTickerPricesForUser(userId, userCurrency);
        result.pricesUpdated = priceRefreshResult.updated;
        result.pricesFailed = priceRefreshResult.failed.length;
        result.priceErrors = priceRefreshResult.failed;
        result.syncedPrices = priceRefreshResult.synced;
      } catch (error) {
        console.error("Error refreshing ticker prices during sync:", error);
        // Continue even if price refresh fails
      }
    }

    return NextResponse.json({
      success: result.errors.length === 0 && result.priceErrors.length === 0,
      accountsUpdated: result.accountsUpdated,
      accountsFailed: result.accountsFailed,
      pricesUpdated: result.pricesUpdated,
      pricesFailed: result.pricesFailed,
      errors: result.errors,
      priceErrors: result.priceErrors,
      syncedAccounts: result.syncedAccounts,
      syncedPrices: result.syncedPrices,
      message: buildSyncMessage(result),
    });
  } catch (error: unknown) {
    console.error("Error syncing Plaid balances:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to sync balances" },
      { status: 500 }
    );
  }
}
