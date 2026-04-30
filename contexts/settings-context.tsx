"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getSetting, setSetting, getAllSettings } from "@/lib/db/client";
import type { Currency } from '@/lib/settings-store';

interface UserSettings {
  currency: Currency;
  timezone: string;
  autoCopyBudgets: boolean;
}

interface SettingsContextType {
  settings: UserSettings;
  isLoading: boolean;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;
  hasFinnhubApiKey: boolean;
  refreshFinnhubApiKey: () => Promise<void>;
}

const defaultSettings: UserSettings = {
  currency: "USD",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  autoCopyBudgets: false,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Map from context keys to database keys
const DB_KEYS: Record<keyof UserSettings, string> = {
  currency: "CURRENCY",
  timezone: "TIMEZONE",
  autoCopyBudgets: "autoCopyBudgets",
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFinnhubApiKey, setHasFinnhubApiKey] = useState(false);

  // Load settings from database
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const dbSettings = await getAllSettings();

        setSettings({
          currency: (dbSettings[DB_KEYS.currency] as Currency) || "USD",
          timezone: dbSettings[DB_KEYS.timezone] || Intl.DateTimeFormat().resolvedOptions().timeZone,
          autoCopyBudgets: dbSettings[DB_KEYS.autoCopyBudgets] === "true",
        });
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Check if Finnhub API key exists in environment
  const checkFinnhubKey = useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/has-finnhub-key");
      const data = await response.json();
      setHasFinnhubApiKey(data.hasKey);
    } catch (error) {
      console.error("Failed to check Finnhub API key:", error);
      setHasFinnhubApiKey(false);
    }
  }, []);

  useEffect(() => {
    checkFinnhubKey();
  }, [checkFinnhubKey]);

  const updateSetting = useCallback(async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    // Update local state immediately
    setSettings(prev => ({ ...prev, [key]: value }));

    // Persist to database
    try {
      const dbKey = DB_KEYS[key];
      const dbValue: string = typeof value === "boolean" ? String(value) : (value ?? "");
      await setSetting(dbKey, dbValue);
    } catch (error) {
      console.error(`Failed to save setting ${key}:`, error);
      throw error;
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, isLoading, updateSetting, hasFinnhubApiKey, refreshFinnhubApiKey: checkFinnhubKey }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

// Helper hook for just checking API key
export function useHasFinnhubApiKey() {
  const { hasFinnhubApiKey } = useSettings();
  return hasFinnhubApiKey;
}

// Helper hook for currency
export function useCurrency() {
  const { settings } = useSettings();
  return settings.currency;
}

// Helper hook for timezone
export function useTimezone() {
  const { settings } = useSettings();
  return settings.timezone;
}
