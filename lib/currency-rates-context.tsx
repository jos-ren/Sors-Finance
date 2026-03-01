/**
 * Currency Rates Context
 * 
 * Pre-fetches and caches exchange rates for the user's portfolio.
 * Provides SWR-based hooks for deduplicated currency conversion.
 */

"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { useSettings } from "./settings-context";

interface CurrencyRate {
  from: string;
  to: string;
  rate: number;
  source?: string;
  age?: number;
}

interface CurrencyRatesContextType {
  isWarming: boolean;
  getRate: (from: string, to: string) => number | null;
  convert: (amount: number, from: string, to: string) => number;
}

const CurrencyRatesContext = createContext<CurrencyRatesContextType | null>(null);

const fetcher = async (url: string): Promise<CurrencyRate> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch exchange rate");
  return response.json();
};

interface CurrencyRatesProviderProps {
  children: React.ReactNode;
  portfolioItems?: Array<{ currency?: string | null }>;
}

export function CurrencyRatesProvider({ children, portfolioItems = [] }: CurrencyRatesProviderProps) {
  const { settings } = useSettings();
  const userCurrency = settings?.currency || "CAD";
  const [isWarming, setIsWarming] = useState(false);
  const [ratesCache, setRatesCache] = useState<Map<string, number>>(new Map());

  // Identify all unique currency pairs needed
  const neededPairs = useMemo(() => {
    const itemCurrencies = new Set<string>();
    
    portfolioItems.forEach(item => {
      if (item.currency) {
        itemCurrencies.add(item.currency.toUpperCase());
      }
    });

    // Always include USD as it's common
    itemCurrencies.add("USD");

    const pairs: Array<{ from: string; to: string }> = [];

    // All item currencies to user currency
    itemCurrencies.forEach(currency => {
      if (currency !== userCurrency.toUpperCase()) {
        pairs.push({ from: currency, to: userCurrency.toUpperCase() });
      }
    });

    return pairs;
  }, [portfolioItems, userCurrency]);

  // Pre-fetch all needed rates on mount
  useEffect(() => {
    if (neededPairs.length === 0) return;

    console.log(`[CurrencyContext] Pre-fetching ${neededPairs.length} currency pairs:`, neededPairs.map(p => `${p.from}→${p.to}`).join(", "));
    setIsWarming(true);

    const fetchRates = async () => {
      const results = await Promise.allSettled(
        neededPairs.map(async ({ from, to }) => {
          try {
            const response = await fetch(`/api/exchange-rate?from=${from}&to=${to}`);
            if (response.ok) {
              const data: CurrencyRate = await response.json();
              console.log(`[CurrencyContext] ✓ ${from}→${to}: ${data.rate.toFixed(4)}`);
              return { key: `${from}-${to}`, rate: data.rate };
            }
            console.warn(`[CurrencyContext] ✗ ${from}→${to}: Failed`);
            return null;
          } catch {
            console.error(`[CurrencyContext] ✗ ${from}→${to}: Error`);
            return null;
          }
        })
      );

      const newCache = new Map<string, number>();
      results.forEach(result => {
        if (result.status === "fulfilled" && result.value) {
          newCache.set(result.value.key, result.value.rate);
        }
      });

      setRatesCache(newCache);
      setIsWarming(false);
      console.log(`[CurrencyContext] Pre-fetching complete. Cached ${newCache.size} rates.`);
    };

    fetchRates();
  }, [neededPairs]);

  const getRate = (from: string, to: string): number | null => {
    const upperFrom = from.toUpperCase();
    const upperTo = to.toUpperCase();

    if (upperFrom === upperTo) return 1;

    // Check cache first
    const key = `${upperFrom}-${upperTo}`;
    return ratesCache.get(key) || null;
  };

  const convert = (amount: number, from: string, to: string): number => {
    const rate = getRate(from, to);
    if (rate === null) {
      console.warn(`Exchange rate not found for ${from} → ${to}, returning original amount`);
      return amount;
    }
    return amount * rate;
  };

  return (
    <CurrencyRatesContext.Provider value={{ isWarming, getRate, convert }}>
      {children}
    </CurrencyRatesContext.Provider>
  );
}

export function useCurrencyRates() {
  const context = useContext(CurrencyRatesContext);
  if (!context) {
    throw new Error("useCurrencyRates must be used within CurrencyRatesProvider");
  }
  return context;
}

/**
 * SWR-based hook for fetching individual exchange rates with deduplication
 * Use this as a fallback if the rate isn't in the pre-fetched cache
 */
export function useExchangeRate(from: string, to: string, shouldFetch = true) {
  const upperFrom = from.toUpperCase();
  const upperTo = to.toUpperCase();

  // Same currency, no need to fetch
  const needsFetch = shouldFetch && upperFrom !== upperTo;

  const { data, error, isLoading } = useSWR<CurrencyRate>(
    needsFetch ? `/api/exchange-rate?from=${upperFrom}&to=${upperTo}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Dedupe requests for 1 minute
    }
  );

  if (!needsFetch) {
    return { rate: 1, isLoading: false, error: null };
  }

  return {
    rate: data?.rate || null,
    isLoading,
    error,
  };
}

/**
 * Helper hook that combines context cache with SWR fallback
 * This is the recommended way to get exchange rates in components
 */
export function useCurrencyConversion(from: string, to: string) {
  const { getRate } = useCurrencyRates();
  const cachedRate = getRate(from, to);
  
  // Only use SWR if context doesn't have the rate
  const shouldFetchFromSWR = cachedRate === null;
  
  const { rate: swrRate, isLoading } = useExchangeRate(
    from, 
    to,
    shouldFetchFromSWR
  );

  // Use cached rate if available, otherwise use SWR
  const finalRate = cachedRate !== null ? cachedRate : swrRate;

  return {
    rate: finalRate,
    isLoading: shouldFetchFromSWR && isLoading,
    convert: (amount: number) => (finalRate !== null ? amount * finalRate : amount),
  };
}
