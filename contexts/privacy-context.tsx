"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useSyncExternalStore } from "react";
import { formatCurrency, formatCurrencyShort } from "@/lib/utils/formatters";
import { DEFAULT_CURRENCY } from "@/lib/constants";

interface PrivacyContextType {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  formatAmount: (amount: number, currency?: string, showCode?: boolean) => string;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

const PRIVACY_STORAGE_KEY = "sors-privacy-mode";

// Use useSyncExternalStore pattern for hydration-safe localStorage access
function getStoredPrivacyMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PRIVACY_STORAGE_KEY) === "true";
}

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  // Use useSyncExternalStore for hydration-safe state
  const storedValue = useSyncExternalStore(
    subscribeToStorage,
    getStoredPrivacyMode,
    () => false // Server snapshot
  );
  
  const [isPrivacyMode, setIsPrivacyMode] = useState(storedValue);

  // Sync with stored value after hydration
  useEffect(() => {
    setIsPrivacyMode(storedValue);
  }, [storedValue]);

  const togglePrivacyMode = useCallback(() => {
    setIsPrivacyMode((prev) => {
      const newValue = !prev;
      localStorage.setItem(PRIVACY_STORAGE_KEY, String(newValue));
      return newValue;
    });
  }, []);

  const formatAmount = useCallback((amount: number, currency: string = DEFAULT_CURRENCY, showCode: boolean = true) => {
    if (isPrivacyMode) {
      return "******";
    }
    return showCode ? formatCurrency(amount, currency) : formatCurrencyShort(amount, currency);
  }, [isPrivacyMode]);

  const contextValue = useMemo(
    () => ({ isPrivacyMode, togglePrivacyMode, formatAmount }),
    [isPrivacyMode, togglePrivacyMode, formatAmount]
  );

  return (
    <PrivacyContext.Provider value={contextValue}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (context === undefined) {
    throw new Error("usePrivacy must be used within a PrivacyProvider");
  }
  return context;
}
