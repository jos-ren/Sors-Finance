"use client";

import { createContext, useContext, useState, useCallback, useMemo, useRef, ReactNode } from "react";
import { toast } from "sonner";
import { useFinnhubApiKey, useHasFinnhubApiKey } from "@/lib/settings-context";

interface SnapshotProgress {
  isRunning: boolean;
  total: number;
  completed: number;
  failed: number;
  currentTicker?: string;
}

interface SnapshotContextType {
  progress: SnapshotProgress;
  startBackgroundSnapshot: (options?: { forceUpdate?: boolean }) => Promise<void>;
  isSnapshotInProgress: boolean;
}

const SnapshotContext = createContext<SnapshotContextType | undefined>(undefined);

// Rate limit: 60 requests per minute = 1 request per second to be safe
const RATE_LIMIT_DELAY_MS = 1100; // Slightly over 1 second to be safe

export function SnapshotProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<SnapshotProgress>({
    isRunning: false,
    total: 0,
    completed: 0,
    failed: 0,
  });

  const isRunningRef = useRef(false);
  const apiKey = useFinnhubApiKey();
  const hasApiKey = useHasFinnhubApiKey();

  const startBackgroundSnapshot = useCallback(async (options?: { forceUpdate?: boolean }) => {
    // Prevent multiple concurrent snapshots
    if (isRunningRef.current) {
      toast.info("Snapshot already in progress");
      return;
    }

    const { forceUpdate = false } = options || {};

    // Import dynamically to avoid circular dependencies
    const {
      hasSnapshotToday,
      getTodaySnapshot,
      deletePortfolioSnapshot,
      createPortfolioSnapshot,
      getTickerModeItems,
      updatePortfolioItem
    } = await import("./hooks/useDatabase");
    const { lookupTicker, getExchangeRate } = await import("./hooks/useStockPrice");

    // Check if we already have a snapshot today
    const existsToday = await hasSnapshotToday();
    if (existsToday && !forceUpdate) {
      return; // Silently skip if already exists
    }

    // Get ticker items
    const tickerItems = await getTickerModeItems();

    // If no ticker items or no API key, just create snapshot directly
    if (tickerItems.length === 0 || !hasApiKey) {
      if (forceUpdate && existsToday) {
        const todaySnapshot = await getTodaySnapshot();
        if (todaySnapshot?.id) {
          await deletePortfolioSnapshot(todaySnapshot.id);
        }
      }

      try {
        await createPortfolioSnapshot();
        toast.success("Portfolio snapshot saved");
      } catch {
        toast.error("Failed to create snapshot");
      }
      return;
    }

    // Get unique tickers to avoid duplicate API calls
    const uniqueTickers = [...new Set(
      tickerItems
        .map(item => item.ticker?.toUpperCase())
        .filter((ticker): ticker is string => Boolean(ticker))
    )];

    // Start background processing
    isRunningRef.current = true;
    setProgress({
      isRunning: true,
      total: uniqueTickers.length,
      completed: 0,
      failed: 0,
    });

    // Show initial toast for many tickers
    if (uniqueTickers.length > 50) {
      toast.info(`Updating ${uniqueTickers.length} stock prices. This may take a few minutes...`);
    }

    let completedCount = 0;
    let failedCount = 0;
    const failedTickers: string[] = [];

    // Map to store fetched quotes by ticker
    const tickerQuotes = new Map<string, { quote: Awaited<ReturnType<typeof lookupTicker>>; exchangeRate: number }>();

    // First pass: fetch unique ticker prices with rate limiting
    for (let i = 0; i < uniqueTickers.length; i++) {
      const ticker = uniqueTickers[i];

      setProgress(prev => ({
        ...prev,
        currentTicker: ticker,
      }));

      try {
        const quote = await lookupTicker(ticker, apiKey);

        if (!quote) {
          failedCount++;
          failedTickers.push(ticker);
          tickerQuotes.set(ticker, { quote: null, exchangeRate: 1 });
        } else {
          // Get exchange rate if currency differs
          let exchangeRate = 1;
          if (quote.currency !== "CAD") {
            exchangeRate = await getExchangeRate(quote.currency, "CAD");
          }
          tickerQuotes.set(ticker, { quote, exchangeRate });
          completedCount++;
        }
      } catch {
        failedCount++;
        failedTickers.push(ticker);
        tickerQuotes.set(ticker, { quote: null, exchangeRate: 1 });
      }

      setProgress(prev => ({
        ...prev,
        completed: completedCount,
        failed: failedCount,
      }));

      // Rate limit delay (skip on last item)
      if (i < uniqueTickers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }
    }

    // Second pass: update all items using cached quotes (batch without SWR invalidation)
    const updatePromises: Promise<void>[] = [];
    
    for (const item of tickerItems) {
      if (!item.ticker) continue;

      const upperTicker = item.ticker.toUpperCase();
      const cached = tickerQuotes.get(upperTicker);
      if (!cached || !cached.quote) continue;

      const { quote } = cached;

      // Use item's existing currency if user manually set it, otherwise use quote's currency
      const effectiveCurrency = (item.currency && item.currency.trim()) ? item.currency : quote.currency;

      // Get exchange rate based on the effective currency (user's or API's)
      let exchangeRate = 1;
      if (effectiveCurrency !== "CAD") {
        exchangeRate = await getExchangeRate(effectiveCurrency, "CAD");
      }

      // Calculate new value using the correct exchange rate
      const newValue = (item.quantity || 0) * quote.price * exchangeRate;

      // Make direct API call without triggering SWR invalidation
      const updatePromise = fetch(`/api/portfolio/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pricePerUnit: quote.price,
          currency: effectiveCurrency,
          currentValue: newValue,
          lastPriceUpdate: new Date().toISOString(),
        }),
      }).then(async response => {
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to update item ${item.id}:`, response.status, errorText);
        }
      });
      
      updatePromises.push(updatePromise);
    }
    
    // Wait for all updates to complete
    await Promise.all(updatePromises);
    
    // Invalidate SWR cache once after all updates are done
    const { invalidatePortfolio } = await import("./hooks/useDatabase");
    invalidatePortfolio();

    // Get failed item names for the toast message
    const failedItems = tickerItems
      .filter(item => item.ticker && failedTickers.includes(item.ticker.toUpperCase()))
      .map(item => ({ ticker: item.ticker!, name: item.name }));

    // Done with price updates, create snapshot
    if (failedCount === 0) {
      // All succeeded, create snapshot
      if (forceUpdate && existsToday) {
        const todaySnapshot = await getTodaySnapshot();
        if (todaySnapshot?.id) {
          await deletePortfolioSnapshot(todaySnapshot.id);
        }
      }

      try {
        await createPortfolioSnapshot();
        toast.success(`Portfolio snapshot saved (${completedCount} prices updated)`);
      } catch {
        toast.error("Failed to create snapshot");
      }
    } else {
      // Some failed, still create snapshot but warn
      if (forceUpdate && existsToday) {
        const todaySnapshot = await getTodaySnapshot();
        if (todaySnapshot?.id) {
          await deletePortfolioSnapshot(todaySnapshot.id);
        }
      }

      try {
        await createPortfolioSnapshot();
        toast.warning(
          `Snapshot saved with ${failedCount} failed price update${failedCount > 1 ? "s" : ""}. ` +
          `Check: ${failedItems.slice(0, 3).map(f => f.ticker).join(", ")}${failedItems.length > 3 ? "..." : ""}`
        );
      } catch {
        toast.error("Failed to create snapshot");
      }
    }

    // Reset state
    isRunningRef.current = false;
    setProgress({
      isRunning: false,
      total: 0,
      completed: 0,
      failed: 0,
    });
  }, [apiKey, hasApiKey]);

  const contextValue = useMemo(
    () => ({
      progress,
      startBackgroundSnapshot,
      isSnapshotInProgress: progress.isRunning,
    }),
    [progress, startBackgroundSnapshot]
  );

  return (
    <SnapshotContext.Provider value={contextValue}>
      {children}
    </SnapshotContext.Provider>
  );
}

export function useSnapshot() {
  const context = useContext(SnapshotContext);
  if (!context) {
    throw new Error("useSnapshot must be used within a SnapshotProvider");
  }
  return context;
}
