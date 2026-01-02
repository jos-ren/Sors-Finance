"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  Upload,
  FileSpreadsheet,
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
  getFinnhubApiKey,
  setFinnhubApiKey,
  getCurrency,
  setCurrency,
  getTimezone,
  setTimezone,
  SUPPORTED_CURRENCIES,
  type Currency,
} from "@/lib/settingsStore";
import { db, getSetting, setSetting } from "@/lib/db";
import { useSetPageHeader } from "@/lib/page-header-context";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

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

  // Snapshot import state
  const [isImportingSnapshots, setIsImportingSnapshots] = useState(false);
  const snapshotFileInputRef = useRef<HTMLInputElement>(null);

  // Preferences state
  const [autoCopyBudgets, setAutoCopyBudgets] = useState(false);

  // Page header
  const sentinelRef = useSetPageHeader("Settings");

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
    // Load saved settings
    const key = getFinnhubApiKey();
    setSavedKey(key);
    if (key) {
      setApiKey(key);
    }

    setCurrencyState(getCurrency());
    setTimezoneState(getTimezone());

    // Load preferences from IndexedDB
    getSetting("autoCopyBudgets").then(value => {
      setAutoCopyBudgets(value === "true");
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
      setFinnhubApiKey(undefined);
      setSavedKey(undefined);
      toast.success("API key removed");
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

      setFinnhubApiKey(trimmedKey);
      setSavedKey(trimmedKey);
      toast.success("API key saved and validated");
    } catch (error) {
      console.error("Error validating API key:", error);
      toast.error("Failed to validate API key");
    } finally {
      setIsValidating(false);
    }
  };

  const handleClearApiKey = () => {
    setFinnhubApiKey(undefined);
    setSavedKey(undefined);
    setApiKey("");
    toast.success("API key removed");
  };

  // Currency handler
  const handleCurrencyChange = (value: Currency) => {
    setCurrencyState(value);
    setCurrency(value);
    setCurrencyOpen(false);
    setCurrencySearch("");
    toast.success(`Currency set to ${value}`);
  };

  // Auto-copy budgets handler
  const handleAutoCopyBudgetsChange = async (checked: boolean) => {
    setAutoCopyBudgets(checked);
    await setSetting("autoCopyBudgets", checked ? "true" : "false");
    toast.success(checked ? "Auto-copy budgets enabled" : "Auto-copy budgets disabled");
  };

  // Timezone handler
  const handleTimezoneChange = (value: string) => {
    setTimezoneState(value);
    setTimezone(value);
    setTimezoneOpen(false);
    setTimezoneSearch("");

    // Get short abbreviation like "PST", "EST", etc.
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: value,
        timeZoneName: "short",
      });
      const parts = formatter.formatToParts(new Date());
      const abbrev = parts.find(p => p.type === "timeZoneName")?.value || value;
      toast.success(`Timezone set to ${abbrev}`);
    } catch {
      toast.success(`Timezone set to ${value}`);
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

  // Data reset handler
  const handleResetData = async () => {
    if (resetConfirmText !== "DELETE ALL DATA") {
      toast.error("Please type 'DELETE ALL DATA' to confirm");
      return;
    }

    try {
      // Clear all IndexedDB tables
      await db.transactions.clear();
      await db.categories.clear();
      await db.budgets.clear();
      await db.imports.clear();
      await db.portfolioItems.clear();
      await db.portfolioAccounts.clear();
      await db.portfolioSnapshots.clear();
      await db.settings.clear();

      // Clear API key from settings (keep currency and timezone)
      setFinnhubApiKey(undefined);

      // Re-initialize default categories
      const { seedDefaultCategories } = await import("@/lib/db");
      await seedDefaultCategories();

      // Set flag to show toast after reload
      sessionStorage.setItem("data-reset-success", "true");

      // Reload the page to reset all state
      window.location.reload();
    } catch (error) {
      console.error("Error resetting data:", error);
      toast.error("Failed to reset data");
    }
  };

  // Data export handler
  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // Fetch all data from IndexedDB
      const [
        transactions,
        categories,
        budgets,
        imports,
        portfolioItems,
        portfolioAccounts,
        portfolioSnapshots,
      ] = await Promise.all([
        db.transactions.toArray(),
        db.categories.toArray(),
        db.budgets.toArray(),
        db.imports.toArray(),
        db.portfolioItems.toArray(),
        db.portfolioAccounts.toArray(),
        db.portfolioSnapshots.toArray(),
      ]);

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Add transactions sheet
      if (transactions.length > 0) {
        const transactionsData = transactions.map((t) => ({
          Date: t.date?.toISOString().split("T")[0] || "",
          Description: t.description,
          "Amount Out": t.amountOut,
          "Amount In": t.amountIn,
          "Net Amount": t.netAmount,
          Category: categories.find((c) => c.id === t.categoryId)?.name || "Uncategorized",
          Source: t.source,
        }));
        const ws = XLSX.utils.json_to_sheet(transactionsData);
        XLSX.utils.book_append_sheet(wb, ws, "Transactions");
      }

      // Add categories sheet
      if (categories.length > 0) {
        const categoriesData = categories.map((c) => ({
          Name: c.name,
          Keywords: c.keywords?.join(", ") || "",
          "Is System": c.isSystem ? "Yes" : "No",
          Order: c.order,
        }));
        const ws = XLSX.utils.json_to_sheet(categoriesData);
        XLSX.utils.book_append_sheet(wb, ws, "Categories");
      }

      // Add budgets sheet
      if (budgets.length > 0) {
        const budgetsData = budgets.map((b) => ({
          Category: categories.find((c) => c.id === b.categoryId)?.name || "",
          Amount: b.amount,
          Year: b.year,
          Month: b.month,
        }));
        const ws = XLSX.utils.json_to_sheet(budgetsData);
        XLSX.utils.book_append_sheet(wb, ws, "Budgets");
      }

      // Add import history sheet
      if (imports.length > 0) {
        const importData = imports.map((i) => ({
          Date: i.importedAt?.toISOString() || "",
          Filename: i.fileName,
          Source: i.source,
          "Transaction Count": i.transactionCount,
          "Total Amount": i.totalAmount,
        }));
        const ws = XLSX.utils.json_to_sheet(importData);
        XLSX.utils.book_append_sheet(wb, ws, "Import History");
      }

      // Add portfolio accounts sheet
      if (portfolioAccounts.length > 0) {
        const accountsData = portfolioAccounts.map((a) => ({
          Name: a.name,
          Bucket: a.bucket,
          Order: a.order,
        }));
        const ws = XLSX.utils.json_to_sheet(accountsData);
        XLSX.utils.book_append_sheet(wb, ws, "Portfolio Accounts");
      }

      // Add portfolio items sheet
      if (portfolioItems.length > 0) {
        const itemsData = portfolioItems.map((i) => {
          const account = portfolioAccounts.find((a) => a.id === i.accountId);
          return {
            Name: i.name,
            Account: account?.name || "",
            "Current Value": i.currentValue,
            Quantity: i.quantity || "",
            Ticker: i.ticker || "",
            Currency: i.currency || "",
            "Price Per Unit": i.pricePerUnit || "",
            "Last Price Update": i.lastPriceUpdate?.toISOString() || "",
          };
        });
        const ws = XLSX.utils.json_to_sheet(itemsData);
        XLSX.utils.book_append_sheet(wb, ws, "Portfolio Items");
      }

      // Add portfolio snapshots sheet
      if (portfolioSnapshots.length > 0) {
        const snapshotsData = portfolioSnapshots.map((s) => ({
          Date: s.date?.toISOString().split("T")[0] || "",
          "Net Worth": s.netWorth,
          "Total Savings": s.totalSavings,
          "Total Investments": s.totalInvestments,
          "Total Assets": s.totalAssets,
          "Total Debt": s.totalDebt,
        }));
        const ws = XLSX.utils.json_to_sheet(snapshotsData);
        XLSX.utils.book_append_sheet(wb, ws, "Portfolio Snapshots");
      }

      // Generate filename with date
      const date = new Date().toISOString().split("T")[0];
      const filename = `sors-finance-export-${date}.xlsx`;

      // Download the file
      XLSX.writeFile(wb, filename);
      toast.success("Data exported successfully");
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  // Historical snapshot import handler
  const handleImportSnapshots = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingSnapshots(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      if (rows.length === 0) {
        toast.error("No data found in file");
        return;
      }

      // Parse and validate rows
      const snapshots: Array<{
        date: Date;
        netWorth: number;
        totalSavings: number;
        totalInvestments: number;
        totalAssets: number;
        totalDebt: number;
      }> = [];

      for (const row of rows) {
        // Handle different possible column names
        const dateVal = row["Date"] || row["date"];
        const netWorthVal = row["Net Worth"] || row["NetWorth"] || row["net_worth"] || row["netWorth"];
        const savingsVal = row["Savings"] || row["savings"] || row["Total Savings"] || row["totalSavings"];
        const investmentsVal = row["Investments"] || row["investments"] || row["Total Investments"] || row["totalInvestments"];
        const assetsVal = row["Assets"] || row["assets"] || row["Total Assets"] || row["totalAssets"];
        const debtVal = row["Debt"] || row["debt"] || row["Total Debt"] || row["totalDebt"];

        if (!dateVal) {
          console.warn("Skipping row without date:", row);
          continue;
        }

        // Parse date - handle both string dates and Excel serial numbers
        let date: Date;
        if (typeof dateVal === "number") {
          // Excel serial date
          date = new Date((dateVal - 25569) * 86400 * 1000);
        } else {
          date = new Date(String(dateVal));
        }

        if (isNaN(date.getTime())) {
          console.warn("Skipping row with invalid date:", row);
          continue;
        }

        snapshots.push({
          date,
          netWorth: Number(netWorthVal) || 0,
          totalSavings: Number(savingsVal) || 0,
          totalInvestments: Number(investmentsVal) || 0,
          totalAssets: Number(assetsVal) || 0,
          totalDebt: Number(debtVal) || 0,
        });
      }

      if (snapshots.length === 0) {
        toast.error("No valid snapshots found in file");
        return;
      }

      // Import snapshots into database
      let imported = 0;
      for (const snapshot of snapshots) {
        await db.portfolioSnapshots.add({
          uuid: crypto.randomUUID(),
          date: snapshot.date,
          netWorth: snapshot.netWorth,
          totalSavings: snapshot.totalSavings,
          totalInvestments: snapshot.totalInvestments,
          totalAssets: snapshot.totalAssets,
          totalDebt: snapshot.totalDebt,
          details: { accounts: [], items: [] },
          createdAt: new Date(),
        });
        imported++;
      }

      toast.success(`Imported ${imported} historical snapshots`);
    } catch (error) {
      console.error("Error importing snapshots:", error);
      toast.error("Failed to import snapshots");
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

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          {process.env.NODE_ENV === "development" && (
            <TabsTrigger value="developer">Developer</TabsTrigger>
          )}
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6 max-w-2xl">
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
          {/* Export Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Data
              </CardTitle>
              <CardDescription>
                Download all your data as an Excel file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Export all your transactions, categories, budgets, and portfolio data
                to an Excel file with multiple sheets.
              </p>
              <Button onClick={handleExportData} disabled={isExporting}>
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Exporting..." : "Export to Excel"}
              </Button>
            </CardContent>
          </Card>

          {/* Reset Data */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Delete All Data
              </CardTitle>
              <CardDescription>
                Permanently delete all your data. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  This will permanently delete all your transactions, categories,
                  budgets, portfolio items, and snapshots. Consider exporting your
                  data first.
                </AlertDescription>
              </Alert>
              <Button
                variant="destructive"
                onClick={() => setShowResetDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All Data
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Developer Tab */}
        {process.env.NODE_ENV === "development" && (
          <TabsContent value="developer" className="space-y-6">
            {/* Import Historical Snapshots */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Import Historical Snapshots
                </CardTitle>
                <CardDescription>
                  Upload an Excel file with historical portfolio snapshot data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-medium">Expected format:</h4>
                  <div className="overflow-x-auto">
                    <table className="text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="px-2 py-1 text-left">Date</th>
                          <th className="px-2 py-1 text-left">Net Worth</th>
                          <th className="px-2 py-1 text-left">Savings</th>
                          <th className="px-2 py-1 text-left">Investments</th>
                          <th className="px-2 py-1 text-left">Assets</th>
                          <th className="px-2 py-1 text-left">Debt</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="text-muted-foreground">
                          <td className="px-2 py-1">2025-12-31</td>
                          <td className="px-2 py-1">9999.99</td>
                          <td className="px-2 py-1">499.99</td>
                          <td className="px-2 py-1">450.00</td>
                          <td className="px-2 py-1">6700.00</td>
                          <td className="px-2 py-1">42.00</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dates can be in YYYY-MM-DD format or Excel date format.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={snapshotFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImportSnapshots}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => snapshotFileInputRef.current?.click()}
                    disabled={isImportingSnapshots}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isImportingSnapshots ? "Importing..." : "Upload Excel File"}
                  </Button>
                </div>
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

      {/* Reset Data Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>All transactions</li>
              <li>All categories (except defaults)</li>
              <li>All budgets</li>
              <li>All import history</li>
              <li>All portfolio accounts and items</li>
              <li>All portfolio snapshots</li>
            </ul>
            <div>
              <p className="text-sm font-medium mb-3">
                Type <code className="bg-muted px-1 py-0.5 rounded">DELETE ALL DATA</code> to confirm:
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
              onClick={handleResetData}
              disabled={resetConfirmText !== "DELETE ALL DATA"}
            >
              Delete Everything
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
