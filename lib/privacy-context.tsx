"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";

interface PrivacyContextType {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  formatAmount: (amount: number, formatter?: (n: number) => string) => string;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

const PRIVACY_STORAGE_KEY = "sors-privacy-mode";

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(PRIVACY_STORAGE_KEY);
    if (stored === "true") {
      setIsPrivacyMode(true);
    }
  }, []);

  const togglePrivacyMode = useCallback(() => {
    setIsPrivacyMode((prev) => {
      const newValue = !prev;
      localStorage.setItem(PRIVACY_STORAGE_KEY, String(newValue));
      return newValue;
    });
  }, []);

  const formatAmount = useCallback((amount: number, formatter?: (n: number) => string) => {
    const defaultFormatter = (n: number) =>
      new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);

    const fmt = formatter || defaultFormatter;
    if (!mounted) return fmt(amount);
    if (isPrivacyMode) {
      return "******";
    }
    return fmt(amount);
  }, [mounted, isPrivacyMode]);

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
