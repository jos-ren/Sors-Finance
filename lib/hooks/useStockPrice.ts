import { useState, useEffect, useCallback } from 'react';

export interface StockQuote {
  ticker: string;
  price: number;
  currency: string;
  name: string;
  change: number;
  previousClose?: number;
  marketState?: string;
  isInternational?: boolean;
}

export interface StockApiError {
  error: string;
  code?: 'NO_API_KEY' | 'INVALID_API_KEY' | 'RATE_LIMIT';
}

export interface ExchangeRate {
  rate: number;
  from: string;
  to: string;
}

// In-memory cache for stock prices
const stockCache = new Map<string, { data: StockQuote; timestamp: number }>();
const STOCK_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// In-memory cache for exchange rates
const rateCache = new Map<string, { data: ExchangeRate; timestamp: number }>();
const RATE_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export function useStockPrice(ticker: string | undefined, apiKey: string | null | undefined) {
  const [data, setData] = useState<StockQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrice = useCallback(async (forceRefresh = false) => {
    if (!ticker) {
      setData(null);
      setError(null);
      return null;
    }

    const upperTicker = ticker.toUpperCase();

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = stockCache.get(upperTicker);
      if (cached && Date.now() - cached.timestamp < STOCK_CACHE_DURATION) {
        setData(cached.data);
        setError(null);
        return cached.data;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/stock/${encodeURIComponent(upperTicker)}`, {
        headers: apiKey ? { 'x-finnhub-key': apiKey } : {},
      });

      if (!response.ok) {
        const errorData: StockApiError = await response.json();
        if (errorData.code === 'NO_API_KEY') {
          throw new Error('Finnhub API key not configured. Go to Settings to add your API key.');
        }
        throw new Error(errorData.error || 'Failed to fetch stock price');
      }

      const quote: StockQuote = await response.json();

      // Cache the result
      stockCache.set(upperTicker, { data: quote, timestamp: Date.now() });

      setData(quote);
      return quote;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stock price';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [ticker, apiKey]);

  // Fetch on mount and when ticker changes
  useEffect(() => {
    fetchPrice();
  }, [fetchPrice]);

  return {
    data,
    isLoading,
    error,
    refetch: () => fetchPrice(true),
  };
}

export function useExchangeRate(from: string | undefined, to: string = 'CAD') {
  const [data, setData] = useState<ExchangeRate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRate = useCallback(async (forceRefresh = false) => {
    if (!from) {
      setData(null);
      setError(null);
      return null;
    }

    const upperFrom = from.toUpperCase();
    const upperTo = to.toUpperCase();

    // Same currency, no conversion needed
    if (upperFrom === upperTo) {
      const rate: ExchangeRate = { rate: 1, from: upperFrom, to: upperTo };
      setData(rate);
      return rate;
    }

    const cacheKey = `${upperFrom}${upperTo}`;

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = rateCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < RATE_CACHE_DURATION) {
        setData(cached.data);
        setError(null);
        return cached.data;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/exchange-rate?from=${encodeURIComponent(upperFrom)}&to=${encodeURIComponent(upperTo)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch exchange rate');
      }

      const rate: ExchangeRate = await response.json();

      // Cache the result
      rateCache.set(cacheKey, { data: rate, timestamp: Date.now() });

      setData(rate);
      return rate;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch exchange rate';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  // Fetch on mount and when currencies change
  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  return {
    data,
    isLoading,
    error,
    refetch: () => fetchRate(true),
  };
}

// Utility function to lookup a ticker (for one-time lookups in forms)
export async function lookupTicker(ticker: string, apiKey?: string | null): Promise<StockQuote | null> {
  if (!ticker) return null;

  const upperTicker = ticker.toUpperCase();

  // Check cache first
  const cached = stockCache.get(upperTicker);
  if (cached && Date.now() - cached.timestamp < STOCK_CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await fetch(`/api/stock/${encodeURIComponent(upperTicker)}`, {
      headers: apiKey ? { 'x-finnhub-key': apiKey } : {},
    });

    if (!response.ok) {
      return null;
    }

    const quote: StockQuote = await response.json();

    // Cache the result
    stockCache.set(upperTicker, { data: quote, timestamp: Date.now() });

    return quote;
  } catch {
    return null;
  }
}

// Utility function to get exchange rate (for one-time lookups in forms)
export async function getExchangeRate(from: string, to: string = 'CAD'): Promise<number> {
  const upperFrom = from.toUpperCase();
  const upperTo = to.toUpperCase();

  // Same currency, no conversion needed
  if (upperFrom === upperTo) {
    return 1;
  }

  const cacheKey = `${upperFrom}${upperTo}`;

  // Check cache first
  const cached = rateCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < RATE_CACHE_DURATION) {
    return cached.data.rate;
  }

  try {
    const response = await fetch(
      `/api/exchange-rate?from=${encodeURIComponent(upperFrom)}&to=${encodeURIComponent(upperTo)}`
    );

    if (!response.ok) {
      return 1; // Fallback to 1:1 if rate fetch fails
    }

    const rate: ExchangeRate = await response.json();

    // Cache the result
    rateCache.set(cacheKey, { data: rate, timestamp: Date.now() });

    return rate.rate;
  } catch {
    return 1; // Fallback to 1:1 if rate fetch fails
  }
}

// Clear all caches (useful for testing or manual refresh)
export function clearStockCache() {
  stockCache.clear();
  rateCache.clear();
}

// Result of refreshing all ticker prices
export interface RefreshAllResult {
  success: boolean;
  updated: number;
  failed: Array<{ ticker: string; itemName: string; error: string }>;
}

// Result of creating a snapshot with price refresh
export interface SnapshotResult {
  success: boolean;
  snapshotId?: number;
  priceRefreshResult?: RefreshAllResult;
  error?: string;
  alreadyExists?: boolean;
}

// Refresh all ticker-mode items and update their prices
// Returns success only if ALL tickers are fetched successfully
export async function refreshAllTickerPrices(apiKey?: string | null): Promise<RefreshAllResult> {
  // Import dynamically to avoid circular dependencies
  const { getTickerModeItems, updatePortfolioItem } = await import('./useDatabase');

  const items = await getTickerModeItems();

  if (items.length === 0) {
    return { success: true, updated: 0, failed: [] };
  }

  // Get unique tickers to avoid duplicate API calls
  const uniqueTickers = [...new Set(
    items
      .map(item => item.ticker?.toUpperCase())
      .filter((ticker): ticker is string => Boolean(ticker))
  )];

  // First pass: fetch unique ticker prices
  const tickerQuotes = new Map<string, { quote: StockQuote | null; exchangeRate: number; error?: string }>();
  const failedTickers: string[] = [];

  for (const ticker of uniqueTickers) {
    try {
      const quote = await lookupTicker(ticker, apiKey);

      if (!quote) {
        failedTickers.push(ticker);
        tickerQuotes.set(ticker, { quote: null, exchangeRate: 1, error: 'Ticker not found' });
      } else {
        // Get exchange rate if currency differs
        let exchangeRate = 1;
        if (quote.currency !== 'CAD') {
          exchangeRate = await getExchangeRate(quote.currency, 'CAD');
        }
        tickerQuotes.set(ticker, { quote, exchangeRate });
      }
    } catch (error) {
      failedTickers.push(ticker);
      tickerQuotes.set(ticker, {
        quote: null,
        exchangeRate: 1,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
    if (effectiveCurrency !== 'CAD') {
      exchangeRate = await getExchangeRate(effectiveCurrency, 'CAD');
    }

    // Calculate new value using the correct exchange rate
    const newValue = (item.quantity || 0) * quote.price * exchangeRate;

    // Update the item - preserve user-set currency
    await updatePortfolioItem(item.id!, {
      pricePerUnit: quote.price,
      currency: effectiveCurrency,
      currentValue: newValue,
      lastPriceUpdate: new Date(),
      isInternational: quote.isInternational,
    });

    updated++;
  }

  return {
    success: failed.length === 0,
    updated,
    failed
  };
}

// Create a portfolio snapshot with price refresh
// This function:
// 1. Checks if there's already a snapshot today (only one per day, unless forceUpdate)
// 2. Refreshes all ticker-mode prices
// 3. Only creates snapshot if ALL tickers succeed (or there are none)
// 4. Returns detailed results for UI feedback
//
// Options:
// - forceUpdate: If true, will replace existing snapshot for today instead of skipping
// - apiKey: Finnhub API key for fetching stock prices
export async function createSnapshotWithPriceRefresh(options?: { forceUpdate?: boolean; apiKey?: string | null }): Promise<SnapshotResult> {
  const { forceUpdate = false, apiKey } = options || {};

  // Import dynamically to avoid circular dependencies
  const { hasSnapshotToday, getTodaySnapshot, deletePortfolioSnapshot, createPortfolioSnapshot, getTickerModeItems } = await import('./useDatabase');

  // Check if we already have a snapshot today
  const existsToday = await hasSnapshotToday();
  if (existsToday && !forceUpdate) {
    return {
      success: true,
      alreadyExists: true
    };
  }

  // Check if there are any ticker-mode items that need refreshing
  const tickerItems = await getTickerModeItems();

  // If there are ticker items, refresh their prices first
  if (tickerItems.length > 0) {
    const priceRefreshResult = await refreshAllTickerPrices(apiKey);

    // If any ticker failed, don't create snapshot
    if (!priceRefreshResult.success) {
      return {
        success: false,
        priceRefreshResult,
        error: `Failed to fetch prices for ${priceRefreshResult.failed.length} ticker(s). Please update failed items to manual mode or fix the tickers.`
      };
    }
  }

  // If forceUpdate and snapshot exists today, delete the old one first
  if (forceUpdate && existsToday) {
    const todaySnapshot = await getTodaySnapshot();
    if (todaySnapshot?.id) {
      await deletePortfolioSnapshot(todaySnapshot.id);
    }
  }

  // All tickers succeeded (or there are none), create the snapshot
  try {
    const snapshotId = await createPortfolioSnapshot();
    return {
      success: true,
      snapshotId,
      priceRefreshResult: tickerItems.length > 0 ? { success: true, updated: tickerItems.length, failed: [] } : undefined
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create snapshot'
    };
  }
}
