"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  ExternalLink,
  Key,
  Check,
  X,
  AlertTriangle,
  Globe,
  DollarSign,
  Download,
  Trash2,
  Plus,
  Pencil,
  ChevronsUpDown,
  Clock,
  Info,
  LogOut,
  User,
  Upload,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  SUPPORTED_CURRENCIES,
  type Currency,
} from "@/lib/settingsStore";
import {
  getSetting,
  setSetting,
} from "@/lib/db/client";
import { useSetPageHeader } from "@/lib/page-header-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

// Generate timezone list with UTC offsets and friendly names
function getTimezoneWithOffset(tz: string): { value: string; label: string; offset: number } {
  try {
    const now = new Date();

    // Get the offset (e.g., "GMT-5")
    const offsetFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const offsetParts = offsetFormatter.formatToParts(now);
    const offsetStr = offsetParts.find(p => p.type === "timeZoneName")?.value || "UTC";

    // Get the long name (e.g., "Eastern Standard Time")
    const nameFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "long",
    });
    const nameParts = nameFormatter.formatToParts(now);
    const longName = nameParts.find(p => p.type === "timeZoneName")?.value || tz;

    // Parse offset for sorting
    let offsetMinutes = 0;
    const match = offsetStr.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (match) {
      const sign = match[1] === "+" ? 1 : -1;
      const hours = parseInt(match[2], 10);
      const minutes = match[3] ? parseInt(match[3], 10) : 0;
      offsetMinutes = sign * (hours * 60 + minutes);
    }

    return {
      value: tz,
      label: `(${offsetStr}) ${longName}`,
      offset: offsetMinutes,
    };
  } catch {
    return { value: tz, label: tz, offset: 0 };
  }
}

// Curated list of major timezones (one per UTC offset region)
const TIMEZONE_LIST = [
  "Pacific/Midway",        // UTC-11
  "Pacific/Honolulu",      // UTC-10
  "America/Anchorage",     // UTC-9
  "America/Los_Angeles",   // UTC-8
  "America/Denver",        // UTC-7
  "America/Chicago",       // UTC-6
  "America/New_York",      // UTC-5
  "America/Toronto",       // UTC-5
  "America/Halifax",       // UTC-4
  "America/St_Johns",      // UTC-3:30
  "America/Sao_Paulo",     // UTC-3
  "Atlantic/South_Georgia",// UTC-2
  "Atlantic/Azores",       // UTC-1
  "Europe/London",         // UTC+0
  "Europe/Paris",          // UTC+1
  "Europe/Berlin",         // UTC+1
  "Europe/Helsinki",       // UTC+2
  "Europe/Moscow",         // UTC+3
  "Asia/Dubai",            // UTC+4
  "Asia/Karachi",          // UTC+5
  "Asia/Kolkata",          // UTC+5:30
  "Asia/Dhaka",            // UTC+6
  "Asia/Bangkok",          // UTC+7
  "Asia/Singapore",        // UTC+8
  "Asia/Hong_Kong",        // UTC+8
  "Asia/Shanghai",         // UTC+8
  "Asia/Tokyo",            // UTC+9
  "Asia/Seoul",            // UTC+9
  "Australia/Adelaide",    // UTC+9:30
  "Australia/Sydney",      // UTC+10
  "Pacific/Noumea",        // UTC+11
  "Pacific/Auckland",      // UTC+12
  "Pacific/Fiji",          // UTC+12
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "general";
  const [activeTab, setActiveTab] = useState(initialTab);

  // API Key state
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | undefined>();
  const [isValidating, setIsValidating] = useState(false);

  // Currency & Timezone state
  const [currency, setCurrencyState] = useState<Currency>("USD");
  const [timezone, setTimezoneState] = useState("");

  // Search states for dropdowns
  const [currencySearch, setCurrencySearch] = useState("");
  const [timezoneSearch, setTimezoneSearch] = useState("");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [highlightedCurrencyIndex, setHighlightedCurrencyIndex] = useState(0);
  const [highlightedTimezoneIndex, setHighlightedTimezoneIndex] = useState(0);
  const currencyListRef = useRef<HTMLDivElement>(null);
  const timezoneListRef = useRef<HTMLDivElement>(null);

  // Dialog states
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Dev page dialog states
  const [showDevAlertDialog, setShowDevAlertDialog] = useState(false);
  const [showDevDialog, setShowDevDialog] = useState(false);

  // Preferences state
  const [autoCopyBudgets, setAutoCopyBudgets] = useState(false);

  // Snapshot scheduler state
  const [snapshotEnabled, setSnapshotEnabled] = useState(true);
  const [snapshotTime, setSnapshotTime] = useState("03:00");
  const [isLoadingSnapshotConfig, setIsLoadingSnapshotConfig] = useState(true);

  // Snapshot import/export state
  const [isExportingSnapshots, setIsExportingSnapshots] = useState(false);
  const [isImportingSnapshots, setIsImportingSnapshots] = useState(false);
  const snapshotFileInputRef = useRef<HTMLInputElement>(null);

  // Data import state
  const [isImporting, setIsImporting] = useState(false);
  const dataFileInputRef = useRef<HTMLInputElement>(null);

  // Page header
  const sentinelRef = useSetPageHeader("Settings");

  // Auth
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Failed to log out");
    }
  };

  // Generate timezone options with offsets
  const timezoneOptions = useMemo(() => {
    return TIMEZONE_LIST.map(tz => getTimezoneWithOffset(tz))
      .sort((a, b) => a.offset - b.offset);
  }, []);

  // Filter currencies based on search
  const filteredCurrencies = useMemo(() => {
    if (!currencySearch.trim()) return SUPPORTED_CURRENCIES;
    const search = currencySearch.toLowerCase();
    return SUPPORTED_CURRENCIES.filter(
      c => c.value.toLowerCase().includes(search) ||
           c.label.toLowerCase().includes(search)
    );
  }, [currencySearch]);

  // Filter timezones based on search
  const filteredTimezones = useMemo(() => {
    if (!timezoneSearch.trim()) return timezoneOptions;
    const search = timezoneSearch.toLowerCase();
    return timezoneOptions.filter(
      tz => tz.value.toLowerCase().includes(search) ||
            tz.label.toLowerCase().includes(search)
    );
  }, [timezoneSearch, timezoneOptions]);

  // Reset highlight index when filter changes
  useEffect(() => {
    setHighlightedCurrencyIndex(0);
  }, [filteredCurrencies]);

  useEffect(() => {
    setHighlightedTimezoneIndex(0);
  }, [filteredTimezones]);

  useEffect(() => {
    // Load saved settings from database
    const loadSettings = async () => {
      try {
        const [apiKeyValue, currencyValue, timezoneValue, autoCopyValue] = await Promise.all([
          getSetting("FINNHUB_API_KEY"),
          getSetting("CURRENCY"),
          getSetting("TIMEZONE"),
          getSetting("autoCopyBudgets"),
        ]);

        if (apiKeyValue) {
          setSavedKey(apiKeyValue);
          setApiKey(apiKeyValue);
        }

        if (currencyValue) {
          setCurrencyState(currencyValue as Currency);
        }

        if (timezoneValue) {
          setTimezoneState(timezoneValue);
        } else {
          // Default to browser timezone if not set
          const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          setTimezoneState(defaultTimezone);
        }

        setAutoCopyBudgets(autoCopyValue === "true");
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };

    loadSettings();

    // Load snapshot scheduler config
    fetch("/api/scheduler/config")
      .then(res => res.json())
      .then(({ data }) => {
        setSnapshotEnabled(data?.enabled ?? true);
        setSnapshotTime(data?.time || "03:00");
      })
      .catch(err => {
        console.error("Failed to load scheduler config:", err);
      })
      .finally(() => {
        setIsLoadingSnapshotConfig(false);
      });

    // Check if we just reset data and show toast (with delay to ensure Toaster is mounted)
    if (sessionStorage.getItem("data-reset-success")) {
      sessionStorage.removeItem("data-reset-success");
      setTimeout(() => {
        toast.success("All data has been reset");
      }, 100);
    }
  }, []);

  // API Key handlers
  const handleSaveApiKey = async () => {
    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      try {
        await setSetting("FINNHUB_API_KEY", "");
        setSavedKey(undefined);
        toast.success("API key removed");
      } catch (error) {
        console.error("Failed to remove API key:", error);
        toast.error("Failed to remove API key");
      }
      return;
    }

    setIsValidating(true);
    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${trimmedKey}`
      );

      if (response.status === 401) {
        toast.error("Invalid API key");
        return;
      }

      if (response.status === 429) {
        toast.error("Rate limit exceeded. Try again later.");
        return;
      }

      if (!response.ok) {
        toast.error("Failed to validate API key");
        return;
      }

      const data = await response.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }

      await setSetting("FINNHUB_API_KEY", trimmedKey);
      setSavedKey(trimmedKey);
      toast.success("API key saved and validated");
    } catch (error) {
      console.error("Error validating API key:", error);
      toast.error("Failed to validate API key");
    } finally {
      setIsValidating(false);
    }
  };

  const handleClearApiKey = async () => {
    try {
      await setSetting("FINNHUB_API_KEY", "");
      setSavedKey(undefined);
      setApiKey("");
      toast.success("API key removed");
    } catch (error) {
      console.error("Failed to remove API key:", error);
      toast.error("Failed to remove API key");
    }
  };

  // Currency handler
  const handleCurrencyChange = async (value: Currency) => {
    setCurrencyState(value);
    setCurrencyOpen(false);
    setCurrencySearch("");
    try {
      await setSetting("CURRENCY", value);
      toast.success(`Currency set to ${value}`);
    } catch (error) {
      console.error("Failed to save currency:", error);
      toast.error("Failed to save currency setting");
    }
  };

  // Auto-copy budgets handler
  const handleAutoCopyBudgetsChange = async (checked: boolean) => {
    setAutoCopyBudgets(checked);
    await setSetting("autoCopyBudgets", checked ? "true" : "false");
    toast.success(checked ? "Auto-copy budgets enabled" : "Auto-copy budgets disabled");
  };

  // Snapshot scheduler handlers
  const handleSnapshotEnabledChange = async (checked: boolean) => {
    try {
      const res = await fetch("/api/scheduler/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setSnapshotEnabled(checked);
      toast.success(checked ? "Automatic snapshots enabled" : "Automatic snapshots disabled");
    } catch (err) {
      console.error("Failed to update snapshot enabled:", err);
      toast.error("Failed to update setting");
    }
  };

  const handleSnapshotTimeChange = async (time: string) => {
    // Validate HH:MM format
    if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      toast.error("Invalid time format. Use HH:MM (e.g., 03:00)");
      return;
    }
    try {
      const res = await fetch("/api/scheduler/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setSnapshotTime(time);
      toast.success(`Snapshot time set to ${time}`);
    } catch (err) {
      console.error("Failed to update snapshot time:", err);
      toast.error("Failed to update setting");
    }
  };

  // Timezone handler
  const handleTimezoneChange = async (value: string) => {
    setTimezoneState(value);
    setTimezoneOpen(false);
    setTimezoneSearch("");

    try {
      await setSetting("TIMEZONE", value);
      // Get short abbreviation like "PST", "EST", etc.
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: value,
        timeZoneName: "short",
      });
      const parts = formatter.formatToParts(new Date());
      const abbrev = parts.find(p => p.type === "timeZoneName")?.value || value;
      toast.success(`Timezone set to ${abbrev}`);
    } catch (error) {
      console.error("Failed to save timezone:", error);
      toast.error("Failed to save timezone setting");
    }
  };

  // Keyboard navigation for currency
  const handleCurrencyKeyDown = (e: React.KeyboardEvent) => {
    if (!currencyOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        setCurrencyOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedCurrencyIndex(prev =>
          Math.min(prev + 1, filteredCurrencies.length - 1)
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedCurrencyIndex(prev => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredCurrencies[highlightedCurrencyIndex]) {
          handleCurrencyChange(filteredCurrencies[highlightedCurrencyIndex].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        setCurrencyOpen(false);
        setCurrencySearch("");
        break;
    }
  };

  // Keyboard navigation for timezone
  const handleTimezoneKeyDown = (e: React.KeyboardEvent) => {
    if (!timezoneOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        setTimezoneOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedTimezoneIndex(prev =>
          Math.min(prev + 1, filteredTimezones.length - 1)
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedTimezoneIndex(prev => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredTimezones[highlightedTimezoneIndex]) {
          handleTimezoneChange(filteredTimezones[highlightedTimezoneIndex].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        setTimezoneOpen(false);
        setTimezoneSearch("");
        break;
    }
  };

  // Get display label for current currency
  const currentCurrencyLabel = useMemo(() => {
    const curr = SUPPORTED_CURRENCIES.find(c => c.value === currency);
    return curr ? `${curr.value} - ${curr.label}` : currency;
  }, [currency]);

  // Get display label for current timezone
  const currentTimezoneLabel = useMemo(() => {
    const tz = timezoneOptions.find(t => t.value === timezone);
    return tz?.label || timezone;
  }, [timezone, timezoneOptions]);

  // Delete account handler
  const handleDeleteAccount = async () => {
    if (resetConfirmText !== "DELETE MY ACCOUNT") {
      toast.error("Please type 'DELETE MY ACCOUNT' to confirm");
      return;
    }

    try {
      // Delete account via API
      const res = await fetch("/api/auth/me", { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to delete account");
      }

      // Redirect to login page
      window.location.href = "/login";
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account");
    }
  };

  // Data export handler
  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // Fetch all data from API
      const res = await fetch("/api/data");
      if (!res.ok) {
        throw new Error("Failed to fetch data");
      }
      const { data: exportData } = await res.json();

      // Create export object with metadata
      const jsonExport = {
        exportedAt: new Date().toISOString(),
        version: 1,
        data: exportData,
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(jsonExport, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sors-finance-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Data exported successfully");
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  // Data import handler
  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      if (!importData.data) {
        throw new Error("Invalid export file format");
      }

      // Send to API for import
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importData.data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to import data");
      }

      const result = await res.json();
      const imported = result.data?.imported || {};
      toast.success(`Imported ${imported.transactions || 0} transactions, ${imported.categories || 0} categories, ${imported.budgets || 0} budgets`);

      // Reload the page to refresh all data
      window.location.reload();
    } catch (error) {
      console.error("Error importing data:", error);
      toast.error(error instanceof Error ? error.message : "Failed to import data. Check file format.");
    } finally {
      setIsImporting(false);
      // Reset file input
      if (dataFileInputRef.current) {
        dataFileInputRef.current.value = "";
      }
    }
  };

  // Snapshot export handler
  const handleExportSnapshots = async () => {
    setIsExportingSnapshots(true);
    try {
      const res = await fetch("/api/portfolio/snapshots");
      if (!res.ok) {
        throw new Error("Failed to fetch snapshots");
      }
      const { data: snapshots } = await res.json();

      if (!snapshots || snapshots.length === 0) {
        toast.error("No snapshots to export");
        return;
      }

      // Create export object with metadata
      const exportData = {
        exportedAt: new Date().toISOString(),
        version: 1,
        count: snapshots.length,
        snapshots: snapshots.map((s: {
          date: string;
          totalSavings: number;
          totalInvestments: number;
          totalAssets: number;
          totalDebt: number;
          netWorth: number;
          details: unknown;
        }) => ({
          date: s.date,
          totalSavings: s.totalSavings,
          totalInvestments: s.totalInvestments,
          totalAssets: s.totalAssets,
          totalDebt: s.totalDebt,
          netWorth: s.netWorth,
          details: s.details,
        })),
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sors-snapshots-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${snapshots.length} snapshots`);
    } catch (error) {
      console.error("Error exporting snapshots:", error);
      toast.error("Failed to export snapshots");
    } finally {
      setIsExportingSnapshots(false);
    }
  };

  // Snapshot import handler
  const handleImportSnapshots = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingSnapshots(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.snapshots || !Array.isArray(data.snapshots)) {
        throw new Error("Invalid snapshot file format");
      }

      let imported = 0;
      let skipped = 0;

      for (const snapshot of data.snapshots) {
        if (!snapshot.date) {
          skipped++;
          continue;
        }

        try {
          const res = await fetch("/api/portfolio/snapshots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: snapshot.date,
              totalSavings: snapshot.totalSavings ?? 0,
              totalInvestments: snapshot.totalInvestments ?? 0,
              totalAssets: snapshot.totalAssets ?? 0,
              totalDebt: snapshot.totalDebt ?? 0,
              netWorth: snapshot.netWorth ?? 0,
              details: snapshot.details ?? { accounts: [], items: [] },
            }),
          });

          if (res.ok) {
            imported++;
          } else {
            skipped++;
          }
        } catch {
          skipped++;
        }
      }

      if (imported > 0) {
        toast.success(`Imported ${imported} snapshots${skipped > 0 ? `, ${skipped} skipped` : ""}`);
      } else {
        toast.error("No snapshots were imported");
      }
    } catch (error) {
      console.error("Error importing snapshots:", error);
      toast.error("Failed to import snapshots. Check file format.");
    } finally {
      setIsImportingSnapshots(false);
      // Reset file input
      if (snapshotFileInputRef.current) {
        snapshotFileInputRef.current.value = "";
      }
    }
  };

  const hasKey = Boolean(savedKey);

  // Developer page content
  const colors = [
    { name: "Background", var: "--background", class: "bg-background" },
    { name: "Foreground", var: "--foreground", class: "bg-foreground" },
    { name: "Primary", var: "--primary", class: "bg-primary" },
    { name: "Primary Foreground", var: "--primary-foreground", class: "bg-primary-foreground" },
    { name: "Secondary", var: "--secondary", class: "bg-secondary" },
    { name: "Secondary Foreground", var: "--secondary-foreground", class: "bg-secondary-foreground" },
    { name: "Muted", var: "--muted", class: "bg-muted" },
    { name: "Muted Foreground", var: "--muted-foreground", class: "bg-muted-foreground" },
    { name: "Accent", var: "--accent", class: "bg-accent" },
    { name: "Accent Foreground", var: "--accent-foreground", class: "bg-accent-foreground" },
    { name: "Destructive", var: "--destructive", class: "bg-destructive" },
    { name: "Border", var: "--border", class: "bg-border" },
    { name: "Input", var: "--input", class: "bg-input" },
    { name: "Ring", var: "--ring", class: "bg-ring" },
    { name: "Card", var: "--card", class: "bg-card" },
    { name: "Card Foreground", var: "--card-foreground", class: "bg-card-foreground" },
    { name: "Popover", var: "--popover", class: "bg-popover" },
    { name: "Popover Foreground", var: "--popover-foreground", class: "bg-popover-foreground" },
  ];

  const chartColors = [
    { name: "Chart 1", var: "--chart-1", class: "bg-chart-1" },
    { name: "Chart 2", var: "--chart-2", class: "bg-chart-2" },
    { name: "Chart 3", var: "--chart-3", class: "bg-chart-3" },
    { name: "Chart 4", var: "--chart-4", class: "bg-chart-4" },
    { name: "Chart 5", var: "--chart-5", class: "bg-chart-5" },
    { name: "Chart Success", var: "--chart-success", class: "bg-[var(--chart-success)]" },
    { name: "Chart Danger", var: "--chart-danger", class: "bg-[var(--chart-danger)]" },
    { name: "Alt Orange", var: "--alt-orange", class: "bg-[var(--alt-orange)]" },
    { name: "Alt Amber", var: "--alt-amber", class: "bg-[var(--alt-amber)]" },
    { name: "Alt Blue", var: "--alt-blue", class: "bg-[var(--alt-blue)]" },
    { name: "Alt Cyan", var: "--alt-cyan", class: "bg-[var(--alt-cyan)]" },
    { name: "Alt Emerald", var: "--alt-emerald", class: "bg-[var(--alt-emerald)]" },
    { name: "Alt Fuchsia", var: "--alt-fuchsia", class: "bg-[var(--alt-fuchsia)]" },
    { name: "Alt Green", var: "--alt-green", class: "bg-[var(--alt-green)]" },
    { name: "Alt Indigo", var: "--alt-indigo", class: "bg-[var(--alt-indigo)]" },
    { name: "Alt Lime", var: "--alt-lime", class: "bg-[var(--alt-lime)]" },
    { name: "Alt Pink", var: "--alt-pink", class: "bg-[var(--alt-pink)]" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your app preferences and integrations
        </p>
        <div ref={sentinelRef} className="h-0" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          {(process.env.NODE_ENV === "development" || user?.username === "joshdev") && (
            <TabsTrigger value="developer">Developer</TabsTrigger>
          )}
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6 max-w-2xl">
          {/* Account */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account
              </CardTitle>
              <CardDescription>
                Your account information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{user?.username}</p>
                    <p className="text-sm text-muted-foreground">Logged in</p>
                  </div>
                </div>
                <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Currency Setting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Currency
              </CardTitle>
              <CardDescription>
                Set your default currency for transactions and portfolio values
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Popover open={currencyOpen} onOpenChange={setCurrencyOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={currencyOpen}
                      className="w-[320px] justify-between font-normal"
                    >
                      {currentCurrencyLabel}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="start">
                    <div className="p-2 border-b">
                      <Input
                        placeholder="Search currencies..."
                        value={currencySearch}
                        onChange={(e) => setCurrencySearch(e.target.value)}
                        onKeyDown={handleCurrencyKeyDown}
                        autoFocus
                      />
                    </div>
                    <div
                      ref={currencyListRef}
                      className="max-h-[300px] overflow-y-auto p-1"
                    >
                      {filteredCurrencies.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          No currency found
                        </div>
                      ) : (
                        filteredCurrencies.map((c, index) => (
                          <div
                            key={c.value}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer",
                              index === highlightedCurrencyIndex && "bg-accent",
                              c.value === currency && "font-medium"
                            )}
                            onClick={() => handleCurrencyChange(c.value)}
                            onMouseEnter={() => setHighlightedCurrencyIndex(index)}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4 shrink-0",
                                c.value === currency ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="font-mono w-10">{c.value}</span>
                            <span className="flex-1 truncate text-muted-foreground">{c.label}</span>
                            <span className="text-muted-foreground">{c.symbol}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <p className="text-sm text-muted-foreground">
                  This assumes all your imported transactions are in this currency.
                  Changing this will not convert existing values.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Timezone Setting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Timezone
              </CardTitle>
              <CardDescription>
                Set your timezone for accurate date handling
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={timezoneOpen}
                      className="w-[320px] justify-between font-normal"
                    >
                      {currentTimezoneLabel || "Select timezone..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="start">
                    <div className="p-2 border-b">
                      <Input
                        placeholder="Search timezones..."
                        value={timezoneSearch}
                        onChange={(e) => setTimezoneSearch(e.target.value)}
                        onKeyDown={handleTimezoneKeyDown}
                        autoFocus
                      />
                    </div>
                    <div
                      ref={timezoneListRef}
                      className="max-h-[300px] overflow-y-auto p-1"
                    >
                      {filteredTimezones.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          No timezone found
                        </div>
                      ) : (
                        filteredTimezones.map((tz, index) => (
                          <div
                            key={tz.value}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer",
                              index === highlightedTimezoneIndex && "bg-accent",
                              tz.value === timezone && "font-medium"
                            )}
                            onClick={() => handleTimezoneChange(tz.value)}
                            onMouseEnter={() => setHighlightedTimezoneIndex(index)}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4 shrink-0",
                                tz.value === timezone ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="flex-1">{tz.label}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <p className="text-sm text-muted-foreground">
                  Defaults to your browser&apos;s timezone on first launch.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6 max-w-2xl">
          {/* Budget Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Budget
              </CardTitle>
              <CardDescription>
                Configure budget behavior and automation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="auto-copy-budgets">Auto-copy budgets</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically copy budget amounts from the previous month when entering a new month with no budgets set
                  </p>
                </div>
                <Switch
                  id="auto-copy-budgets"
                  checked={autoCopyBudgets}
                  onCheckedChange={handleAutoCopyBudgetsChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Portfolio Snapshots */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Portfolio Snapshots
              </CardTitle>
              <CardDescription>
                Configure automatic daily snapshots of your net worth
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingSnapshotConfig ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="snapshot-enabled">Enable automatic snapshots</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically save a snapshot of your portfolio each day
                      </p>
                    </div>
                    <Switch
                      id="snapshot-enabled"
                      checked={snapshotEnabled}
                      onCheckedChange={handleSnapshotEnabledChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="snapshot-time">Snapshot time</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="snapshot-time"
                        type="text"
                        placeholder="03:00"
                        value={snapshotTime}
                        onChange={(e) => setSnapshotTime(e.target.value)}
                        onBlur={(e) => handleSnapshotTimeChange(e.target.value)}
                        className="w-24 font-mono"
                        disabled={!snapshotEnabled}
                        maxLength={5}
                      />
                      <span className="text-sm text-muted-foreground">
                        (HH:MM, 24-hour)
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Time of day when the automatic snapshot will be taken
                    </p>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Important</AlertTitle>
                    <AlertDescription>
                      For automatic snapshots to work, the application must be running:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>
                          <strong>Development:</strong> Keep <code className="bg-muted px-1 py-0.5 rounded text-xs">npm run dev</code> running in your terminal
                        </li>
                        <li>
                          <strong>Docker:</strong> Ensure the Docker container is running
                        </li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Stock Price Data
              </CardTitle>
              <CardDescription>
                Connect to Finnhub to get real-time stock prices for your investments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status indicator */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                {hasKey ? (
                  <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-yellow-600 dark:text-yellow-400">
                    <AlertTriangle className="h-4 w-4" />
                    Not configured
                  </span>
                )}
              </div>

              {/* Explanation when no key */}
              {!hasKey && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No API key configured</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      Without a Finnhub API key, you will need to{" "}
                      <strong>manually update stock prices</strong> for your
                      investments.
                    </p>
                    <p>
                      Finnhub offers a <strong>free tier</strong> with 60 API
                      calls per minute.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* API Key Input */}
              <div className="space-y-2">
                <Label htmlFor="apiKey">Finnhub API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="Enter your Finnhub API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="font-mono"
                  />
                  <Button onClick={handleSaveApiKey} disabled={isValidating}>
                    {isValidating ? "Validating..." : "Save"}
                  </Button>
                  {hasKey && (
                    <Button variant="outline" onClick={handleClearApiKey}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Your API key is stored locally and never sent to our servers.
                </p>
              </div>

              {/* How to get an API key */}
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">How to get a free Finnhub API key:</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>
                    Go to{" "}
                    <a
                      href="https://finnhub.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                      finnhub.io
                    </a>
                  </li>
                  <li>Click &quot;Get free API key&quot; and sign up</li>
                  <li>Copy your API key from the dashboard</li>
                  <li>Paste it above and click Save</li>
                </ol>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://finnhub.io/register"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Sign up for Finnhub (free)
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="space-y-6 max-w-2xl">
          {/* Import/Export Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Import & Export Data
              </CardTitle>
              <CardDescription>
                Backup and restore all your data as a JSON file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-2">
                  <Label>Export Data</Label>
                  <p className="text-sm text-muted-foreground">
                    Download all transactions, categories, budgets, and portfolio data
                  </p>
                  <Button onClick={handleExportData} disabled={isExporting} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? "Exporting..." : "Export to JSON"}
                  </Button>
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Import Data</Label>
                  <p className="text-sm text-muted-foreground">
                    Restore data from a previously exported JSON file
                  </p>
                  <div>
                    <input
                      ref={dataFileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleImportData}
                      className="hidden"
                      id="data-import"
                    />
                    <Button
                      onClick={() => dataFileInputRef.current?.click()}
                      disabled={isImporting}
                      variant="outline"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isImporting ? "Importing..." : "Import from JSON"}
                    </Button>
                  </div>
                </div>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Note</AlertTitle>
                <AlertDescription>
                  Importing will add new records. Existing data with matching IDs will not be duplicated.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Delete Account */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Delete Account
              </CardTitle>
              <CardDescription>
                Permanently delete your account and all associated data. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  This will permanently delete your account and all associated data
                  including transactions, categories, budgets, portfolio items, and
                  snapshots. Consider exporting your data first.
                </AlertDescription>
              </Alert>
              <Button
                variant="destructive"
                onClick={() => setShowResetDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Developer Tab */}
        {(process.env.NODE_ENV === "development" || user?.username === "joshdev") && (
          <TabsContent value="developer" className="space-y-6">
            {/* Snapshot History Import/Export */}
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Snapshot History
                </CardTitle>
                <CardDescription>
                  Import and export your complete portfolio snapshot history
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 space-y-2">
                    <Label>Export Snapshots</Label>
                    <p className="text-sm text-muted-foreground">
                      Download all snapshots as a JSON file for backup or migration
                    </p>
                    <Button
                      onClick={handleExportSnapshots}
                      disabled={isExportingSnapshots}
                      variant="outline"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {isExportingSnapshots ? "Exporting..." : "Export to JSON"}
                    </Button>
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>Import Snapshots</Label>
                    <p className="text-sm text-muted-foreground">
                      Restore snapshots from a previously exported JSON file
                    </p>
                    <div>
                      <input
                        ref={snapshotFileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleImportSnapshots}
                        className="hidden"
                        id="snapshot-import"
                      />
                      <Button
                        onClick={() => snapshotFileInputRef.current?.click()}
                        disabled={isImportingSnapshots}
                        variant="outline"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isImportingSnapshots ? "Importing..." : "Import from JSON"}
                      </Button>
                    </div>
                  </div>
                </div>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Note</AlertTitle>
                  <AlertDescription>
                    Importing snapshots will add new entries. Duplicate dates will create additional snapshots.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Primary Colors */}
            <Card>
              <CardHeader>
                <CardTitle>Primary Colors</CardTitle>
                <CardDescription>Core color palette used throughout the app</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {colors.map((color) => (
                    <div key={color.var} className="space-y-1.5">
                      <div
                        className={`h-16 rounded-lg border ${color.class}`}
                      />
                      <div className="text-xs">
                        <p className="font-medium">{color.name}</p>
                        <p className="text-muted-foreground font-mono">{color.var}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chart Colors */}
            <Card>
              <CardHeader>
                <CardTitle>Chart Colors</CardTitle>
                <CardDescription>Colors used for charts and data visualization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {chartColors.map((color) => (
                    <div key={color.var} className="space-y-1.5">
                      <div
                        className={`h-16 rounded-lg border ${color.class}`}
                      />
                      <div className="text-xs">
                        <p className="font-medium">{color.name}</p>
                        <p className="text-muted-foreground font-mono">{color.var}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Buttons</CardTitle>
                <CardDescription>Button variants and sizes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Variants</p>
                  <div className="flex flex-wrap gap-3">
                    <Button>Default</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="destructive">Destructive</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="link">Link</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Sizes</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="lg">Large</Button>
                    <Button size="default">Default</Button>
                    <Button size="sm">Small</Button>
                    <Button size="icon"><Plus className="h-4 w-4" /></Button>
                    <Button size="icon-sm"><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">With Icons</p>
                  <div className="flex flex-wrap gap-3">
                    <Button><Plus className="h-4 w-4 mr-2" />Add Item</Button>
                    <Button variant="outline"><Pencil className="h-4 w-4 mr-2" />Edit</Button>
                    <Button variant="destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
                    <Button variant="secondary"><Check className="h-4 w-4 mr-2" />Confirm</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">States</p>
                  <div className="flex flex-wrap gap-3">
                    <Button disabled>Disabled</Button>
                    <Button variant="outline" disabled>Disabled Outline</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Badges */}
            <Card>
              <CardHeader>
                <CardTitle>Badges</CardTitle>
                <CardDescription>Badge variants for labels and status indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <Badge variant="outline">Outline</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Dialogs */}
            <Card>
              <CardHeader>
                <CardTitle>Dialogs</CardTitle>
                <CardDescription>Modal dialogs and alert dialogs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => setShowDevDialog(true)}>
                    Open Dialog
                  </Button>
                  <Button variant="destructive" onClick={() => setShowDevAlertDialog(true)}>
                    Open Alert Dialog
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Inputs */}
            <Card>
              <CardHeader>
                <CardTitle>Inputs</CardTitle>
                <CardDescription>Form input components</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Default Input</p>
                    <Input placeholder="Enter text..." />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Disabled Input</p>
                    <Input placeholder="Disabled" disabled />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">With Value</p>
                    <Input defaultValue="Sample value" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Checkbox</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox id="check1" />
                      <label htmlFor="check1" className="text-sm">Unchecked</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="check2" defaultChecked />
                      <label htmlFor="check2" className="text-sm">Checked</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="check3" disabled />
                      <label htmlFor="check3" className="text-sm text-muted-foreground">Disabled</label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tooltips */}
            <Card>
              <CardHeader>
                <CardTitle>Tooltips</CardTitle>
                <CardDescription>Hover tooltips for additional context</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline">Hover me</Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This is a tooltip</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit item</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete item</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardContent>
            </Card>

            {/* Typography */}
            <Card>
              <CardHeader>
                <CardTitle>Typography</CardTitle>
                <CardDescription>Text styles and headings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h1 className="text-4xl font-bold tracking-tight">Heading 1</h1>
                  <h2 className="text-3xl font-bold tracking-tight">Heading 2</h2>
                  <h3 className="text-2xl font-semibold">Heading 3</h3>
                  <h4 className="text-xl font-semibold">Heading 4</h4>
                  <h5 className="text-lg font-medium">Heading 5</h5>
                  <p className="text-base">Body text - The quick brown fox jumps over the lazy dog.</p>
                  <p className="text-sm text-muted-foreground">Muted text - Secondary information.</p>
                  <p className="text-xs text-muted-foreground">Small text - Fine print.</p>
                </div>
              </CardContent>
            </Card>

            {/* Spacing Reference */}
            <Card>
              <CardHeader>
                <CardTitle>Spacing</CardTitle>
                <CardDescription>Common spacing values used in the app</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 6, 8, 12, 16].map((space) => (
                    <div key={space} className="flex items-center gap-3">
                      <div className="bg-primary h-4" style={{ width: `${space * 4}px` }} />
                      <span className="text-sm font-mono text-muted-foreground">
                        {space} ({space * 4}px)
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Your user account</li>
              <li>All transactions</li>
              <li>All categories</li>
              <li>All budgets</li>
              <li>All import history</li>
              <li>All portfolio accounts and items</li>
              <li>All portfolio snapshots</li>
              <li>All app preferences</li>
            </ul>
            <div>
              <p className="text-sm font-medium mb-3">
                Type <code className="bg-muted px-1 py-0.5 rounded">DELETE MY ACCOUNT</code> to confirm:
              </p>
              <Input
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="Type here..."
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResetConfirmText("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={resetConfirmText !== "DELETE MY ACCOUNT"}
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dev Alert Dialog */}
      <AlertDialog open={showDevAlertDialog} onOpenChange={setShowDevAlertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This is an example alert dialog for the developer showcase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dev Dialog */}
      <Dialog open={showDevDialog} onOpenChange={setShowDevDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Example Dialog</DialogTitle>
            <DialogDescription>
              This is an example dialog with a form input.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input placeholder="Enter something..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDevDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowDevDialog(false)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
