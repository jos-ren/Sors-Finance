"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getSetting, setSetting, getAllSettings } from "@/lib/db/client";
import type { Currency } from "@/lib/settingsStore";

interface UserSettings {
  finnhubApiKey: string | null;
  currency: Currency;
  timezone: string;
  autoCopyBudgets: boolean;
}

interface SettingsContextType {
  settings: UserSettings;
  isLoading: boolean;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;
  hasFinnhubApiKey: boolean;
}

const defaultSettings: UserSettings = {
  finnhubApiKey: null,
  currency: "USD",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  autoCopyBudgets: false,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Map from context keys to database keys
const DB_KEYS: Record<keyof UserSettings, string> = {
  finnhubApiKey: "FINNHUB_API_KEY",
  currency: "CURRENCY",
  timezone: "TIMEZONE",
  autoCopyBudgets: "autoCopyBudgets",
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from database
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const dbSettings = await getAllSettings();

        setSettings({
          finnhubApiKey: dbSettings[DB_KEYS.finnhubApiKey] || null,
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

  const updateSetting = useCallback(async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    // Update local state immediately
    setSettings(prev => ({ ...prev, [key]: value }));

    // Persist to database
    try {
      const dbKey = DB_KEYS[key];
      const dbValue = typeof value === "boolean" ? String(value) : (value ?? "");
      await setSetting(dbKey, dbValue);
    } catch (error) {
      console.error(`Failed to save setting ${key}:`, error);
      throw error;
    }
  }, []);

  const hasFinnhubApiKey = Boolean(settings.finnhubApiKey && settings.finnhubApiKey.trim().length > 0);

  return (
    <SettingsContext.Provider value={{ settings, isLoading, updateSetting, hasFinnhubApiKey }}>
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

// Helper hook for getting API key
export function useFinnhubApiKey() {
  const { settings } = useSettings();
  return settings.finnhubApiKey;
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
