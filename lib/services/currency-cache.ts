/**
 * Currency Exchange Rate Cache Utilities
 * 
 * Pre-warms the currency cache with commonly used pairs during sync operations.
 */

import { db } from '@/lib/db/connection';
import { portfolioItems, settings, currencyExchangeRates } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getExchangeRate } from './quotes';

/**
 * Gets all unique currency pairs needed for a user's portfolio
 * Returns pairs like ["USD-CAD", "EUR-CAD", "USD-EUR"]
 */
async function getRequiredCurrencyPairs(userId: number): Promise<string[]> {
  // Get user's preferred currency
  const userSettings = await db
    .select()
    .from(settings)
    .where(and(eq(settings.userId, userId), eq(settings.key, 'CURRENCY')))
    .limit(1);

  const userCurrency = userSettings[0]?.value || 'CAD';

  // Get all unique currencies from portfolio items
  const items = await db
    .select({ currency: portfolioItems.currency })
    .from(portfolioItems)
    .where(and(eq(portfolioItems.userId, userId), eq(portfolioItems.isActive, true)));

  const itemCurrencies = new Set<string>();
  items.forEach(item => {
    if (item.currency) {
      itemCurrencies.add(item.currency.toUpperCase());
    }
  });

  // Always include USD as it's the base for most APIs
  itemCurrencies.add('USD');

  // Generate all needed pairs
  const pairs = new Set<string>();

  // All item currencies to user currency
  itemCurrencies.forEach(currency => {
    if (currency !== userCurrency) {
      pairs.add(`${currency}-${userCurrency}`);
    }
  });

  // Common cross-pairs (for items with different currencies)
  const currencies = Array.from(itemCurrencies);
  for (let i = 0; i < currencies.length; i++) {
    for (let j = i + 1; j < currencies.length; j++) {
      pairs.add(`${currencies[i]}-${currencies[j]}`);
    }
  }

  return Array.from(pairs);
}

/**
 * Fetches and caches exchange rates for a specific currency pair
 */
async function fetchAndCacheRate(from: string, to: string): Promise<number | null> {
  try {
    const result = await getExchangeRate(from, to);
    return result.rate;
  } catch (error) {
    console.error(`Error fetching rate ${from}-${to}:`, error);
    return null;
  }
}

/**
 * Pre-warms the currency cache with all needed exchange rates for a user
 * Should be called during "Sync All" or first-load snapshot
 */
export async function warmCurrencyCache(userId: number): Promise<{
  refreshed: number;
  failed: number;
  pairs: string[];
}> {
  console.log(`[Currency Cache] Warming cache for user ${userId}`);

  const pairs = await getRequiredCurrencyPairs(userId);
  console.log(`[Currency Cache] Found ${pairs.length} currency pairs to refresh:`, pairs);

  let refreshed = 0;
  let failed = 0;

  // Fetch rates in parallel (with some rate limiting)
  const BATCH_SIZE = 5;
  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    const batch = pairs.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      batch.map(async (pair) => {
        const [from, to] = pair.split('-');
        const rate = await fetchAndCacheRate(from, to);
        
        if (rate !== null) {
          refreshed++;
          console.log(`[Currency Cache] ✓ ${from} → ${to}: ${rate}`);
        } else {
          failed++;
          console.log(`[Currency Cache] ✗ ${from} → ${to}: failed`);
        }
      })
    );

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < pairs.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`[Currency Cache] Complete: ${refreshed} refreshed, ${failed} failed`);

  return {
    refreshed,
    failed,
    pairs,
  };
}

/**
 * Gets the age of a cached exchange rate in hours
 * Returns null if rate doesn't exist in cache
 */
export async function getCachedRateAge(from: string, to: string): Promise<number | null> {
  const rates = await db
    .select()
    .from(currencyExchangeRates)
    .where(
      and(
        eq(currencyExchangeRates.fromCurrency, from.toUpperCase()),
        eq(currencyExchangeRates.toCurrency, to.toUpperCase())
      )
    )
    .limit(1);

  if (rates.length === 0) {
    return null;
  }

  const ageMs = Date.now() - rates[0].updatedAt.getTime();
  return ageMs / (1000 * 60 * 60); // Convert to hours
}
