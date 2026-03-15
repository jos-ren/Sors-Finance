"use client";

import { createContext, useContext, useState, useCallback, useMemo, useRef, ReactNode } from "react";
import { toast } from "sonner";
import { useHasFinnhubApiKey, useCurrency } from "@/lib/settings-context";

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
  const hasApiKey = useHasFinnhubApiKey();
  const userCurrency = useCurrency();

  const startBackgroundSnapshot = useCallback(async (options?: { forceUpdate?: boolean }) => {
    // Prevent multiple concurrent snapshots
    if (isRunningRef.current) {
      toast.info("Snapshot already in progress");
      return;
    }

    const { forceUpdate = false } = options || {};

    try {
      isRunningRef.current = true;

      // Step 1: Check if Plaid sync is enabled and sync if needed
      const plaidSyncResponse = await fetch("/api/scheduler/config");
      const config = await plaidSyncResponse.json();
      
      if (config.plaidSync) {
        console.log("[Snapshot] Syncing Plaid balances...");
        toast.info("Syncing account balances...");
        
        try {
          const syncResponse = await fetch("/api/plaid/balances", { method: "POST" });
          if (syncResponse.ok) {
            const syncData = await syncResponse.json();
            if (syncData.accountsUpdated > 0) {
              console.log(`[Snapshot] Synced ${syncData.accountsUpdated} account(s)`);
            }
          }
        } catch (error) {
          console.error("[Snapshot] Plaid sync failed:", error);
          // Continue anyway - don't block snapshot
        }
      }

      // Step 2: Check if price refresh is enabled and refresh if needed
      if (config.priceRefresh) {
        console.log("[Snapshot] Refreshing investment prices...");
        toast.info("Refreshing investment prices...");
        
        // Import dynamically to avoid circular dependencies
        const { getTickerModeItems, updatePortfolioItem } = await import("./hooks/useDatabase");
        const { lookupTicker, getExchangeRate } = await import("./hooks/useStockPrice");

        // Get ticker items
        const tickerItems = await getTickerModeItems();

        if (tickerItems.length > 0) {
          // Check if we have any stocks that require API key
          const hasStocks = tickerItems.some(item => (!item.type || item.type === "stock"));
          
          // Only proceed with price refresh if we don't need API key or if we have it
          if (!hasStocks || hasApiKey) {
            // Get unique tickers to avoid duplicate API calls
            const tickerMap = new Map<string, string>(); // ticker -> tickerType
            for (const item of tickerItems) {
              if (item.ticker) {
                const upperTicker = item.ticker.toUpperCase();
                if (!tickerMap.has(upperTicker)) {
                  tickerMap.set(upperTicker, item.type || "stock");
                }
              }
            }
            const uniqueTickers = Array.from(tickerMap.keys());

            setProgress({
              isRunning: true,
              total: uniqueTickers.length,
              completed: 0,
              failed: 0,
            });

            // First pass: fetch unique ticker prices
            const tickerQuotes = new Map<string, { price: number; currency: string } | null>();
            let completed = 0;
            let failed = 0;

            for (const ticker of uniqueTickers) {
              const tickerType = tickerMap.get(ticker) || "stock";
              setProgress(prev => ({ ...prev, currentTicker: ticker }));

              try {
                let quote = null;
                const tickerType = tickerMap.get(ticker) || "stock";
                
                if (tickerType === "metal") {
                  const response = await fetch(`/api/metals/${encodeURIComponent(ticker)}`);
                  if (response.ok) {
                    quote = await response.json();
                  }
                } else if (tickerType === "crypto") {
                  const response = await fetch(`/api/crypto/${encodeURIComponent(ticker)}`);
                  if (response.ok) {
                    quote = await response.json();
                  }
                } else {
                  quote = await lookupTicker(ticker);
                }
                
                if (quote) {
                  tickerQuotes.set(ticker, quote);
                  completed++;
                } else {
                  failed++;
                }
              } catch (error) {
                console.error(`Failed to fetch ${ticker}:`, error);
                tickerQuotes.set(ticker, null);
                failed++;
              }

              setProgress(prev => ({ ...prev, completed: completed + failed, failed }));
              
              // Rate limiting
              if (completed + failed < uniqueTickers.length) {
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
              }
            }

            // Second pass: update all items using cached quotes
            for (const item of tickerItems) {
              if (!item.ticker) continue;

              const upperTicker = item.ticker.toUpperCase();
              const quote = tickerQuotes.get(upperTicker);

              if (quote) {
                // Get exchange rate if currency differs
                let exchangeRate = 1;
                if (quote.currency !== userCurrency) {
                  exchangeRate = await getExchangeRate(quote.currency, userCurrency);
                }

                const newValue = (item.quantity || 0) * quote.price * exchangeRate;

                await updatePortfolioItem(item.id!, {
                  pricePerUnit: quote.price,
                  currency: quote.currency,
                  currentValue: newValue,
                  lastPriceUpdate: new Date(),
                });
              }
            }

            console.log(`[Snapshot] Price refresh complete: ${completed} updated, ${failed} failed`);
          }
        }
      }

      // Step 3: Create the snapshot
      const {
        hasSnapshotToday,
        getTodaySnapshot,
        deletePortfolioSnapshot,
        createPortfolioSnapshot,
      } = await import("./hooks/useDatabase");

      // Check if we already have a snapshot today
      const existsToday = await hasSnapshotToday();
      if (existsToday && forceUpdate) {
        const todaySnapshot = await getTodaySnapshot();
        if (todaySnapshot?.id) {
          await deletePortfolioSnapshot(todaySnapshot.id);
        }
      } else if (existsToday && !forceUpdate) {
        return; // Silently skip if already exists
      }

      await createPortfolioSnapshot();
      toast.success("Portfolio snapshot saved");
      
    } catch (error) {
      console.error("[Snapshot] Failed:", error);
      toast.error("Failed to create snapshot");
    } finally {
      isRunningRef.current = false;
      setProgress({
        isRunning: false,
        total: 0,
        completed: 0,
        failed: 0,
      });
    }
  }, [hasApiKey, userCurrency]);

  const isSnapshotInProgress = progress.isRunning;

  const value = useMemo(
    () => ({
      progress,
      startBackgroundSnapshot,
      isSnapshotInProgress,
    }),
    [progress, startBackgroundSnapshot, isSnapshotInProgress]
  );

  return (
    <SnapshotContext.Provider value={value}>
      {children}
    </SnapshotContext.Provider>
  );
}

export function useSnapshot() {
  const context = useContext(SnapshotContext);
  if (!context) {
    throw new Error("useSnapshot must be used within SnapshotProvider");
  }
  return context;
}
