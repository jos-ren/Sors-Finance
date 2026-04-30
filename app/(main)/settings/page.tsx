"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Check,
  Globe,
  DollarSign,
  Download,
  Trash2,
  Clock,
  LogOut,
  User,
  Upload,
  Loader2,
  FileText,
  Tag,
  Copy,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import {
  SUPPORTED_CURRENCIES,
  type Currency,
} from '@/lib/settings-store';
import {
  getSetting,
  setSetting,
} from "@/lib/db/client";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import {
  SectionHeader,
  RowGroup,
  NavigateRow,
  ToggleRow,
  ActionRow,
  SettingsPageHeader,
} from "@/components/features/settings/settings-shared";

// ─── Timezone helpers (unchanged) ────────────────────────────────────────────

function getTimezoneWithOffset(tz: string): { value: string; label: string; offset: number } {
  try {
    const now = new Date();

    const offsetFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const offsetParts = offsetFormatter.formatToParts(now);
    const offsetStr = offsetParts.find(p => p.type === "timeZoneName")?.value || "UTC";

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
  // Currency & Timezone state
  const [currency, setCurrencyState] = useState<Currency>("USD");
  const [timezone, setTimezoneState] = useState("");
  const [currencySearch, setCurrencySearch] = useState("");
  const [timezoneSearch, setTimezoneSearch] = useState("");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [pendingCurrency, setPendingCurrency] = useState<Currency>("USD");
  const [pendingTimezone, setPendingTimezone] = useState("");
  const [highlightedCurrencyIndex, setHighlightedCurrencyIndex] = useState(0);
  const [highlightedTimezoneIndex, setHighlightedTimezoneIndex] = useState(0);
  const currencyListRef = useRef<HTMLDivElement>(null);
  const timezoneListRef = useRef<HTMLDivElement>(null);

  // Dialog / UI states
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  // Preferences
  const [autoCopyBudgets, setAutoCopyBudgets] = useState(false);
  const [snapshotEnabled, setSnapshotEnabled] = useState(true);
  const [snapshotTime, setSnapshotTime] = useState("03:00");

  // Data transfer state
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const dataFileInputRef = useRef<HTMLInputElement>(null);

  // API status
  const [finnhubConfigured, setFinnhubConfigured] = useState<boolean | null>(null);
  const [plaidConfigured, setPlaidConfigured] = useState<boolean | null>(null);

  const sentinelRef = useSetPageHeader("Settings");
  const { user, logout } = useAuth();

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [currencyValue, timezoneValue, autoCopyValue] = await Promise.all([
          getSetting("CURRENCY"),
          getSetting("TIMEZONE"),
          getSetting("autoCopyBudgets"),
        ]);
        if (currencyValue) setCurrencyState(currencyValue as Currency);
        if (timezoneValue) {
          setTimezoneState(timezoneValue);
        } else {
          setTimezoneState(Intl.DateTimeFormat().resolvedOptions().timeZone);
        }
        setAutoCopyBudgets(autoCopyValue === "true");
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    };
    loadSettings();

    fetch("/api/scheduler/config")
      .then((r) => r.json())
      .then(({ data }) => {
        setSnapshotEnabled(data?.enabled ?? true);
        setSnapshotTime(data?.time || "03:00");
      })
      .catch(() => {});

    fetch("/api/integrations/status")
      .then((r) => r.json())
      .then((data) => {
        setFinnhubConfigured(data.finnhub);
        setPlaidConfigured(data.plaid);
      })
      .catch(() => {
        setFinnhubConfigured(false);
        setPlaidConfigured(false);
      });

    if (sessionStorage.getItem("data-reset-success")) {
      sessionStorage.removeItem("data-reset-success");
      setTimeout(() => toast.success("All data has been reset"), 100);
    }
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      toast.error("Failed to log out");
    }
  };

  const handleCurrencyChange = async (value: Currency) => {
    setCurrencyState(value);
    setCurrencyOpen(false);
    setCurrencySearch("");
    try {
      await setSetting("CURRENCY", value);
      toast.success(`Currency set to ${value}`);
    } catch {
      toast.error("Failed to save currency setting");
    }
  };

  const handleCurrencySave = () => handleCurrencyChange(pendingCurrency as Currency);

  const handleTimezoneChange = async (value: string) => {
    setTimezoneState(value);
    setTimezoneOpen(false);
    setTimezoneSearch("");
    try {
      await setSetting("TIMEZONE", value);
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: value,
        timeZoneName: "short",
      });
      const abbrev =
        formatter.formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value || value;
      toast.success(`Timezone set to ${abbrev}`);
    } catch {
      toast.error("Failed to save timezone setting");
    }
  };

  const handleTimezoneSave = () => handleTimezoneChange(pendingTimezone);

  const handleAutoCopyBudgetsChange = async (checked: boolean) => {
    setAutoCopyBudgets(checked);
    await setSetting("autoCopyBudgets", checked ? "true" : "false");
    toast.success(checked ? "Auto-copy budgets enabled" : "Auto-copy budgets disabled");
  };

  const handleDeleteAccount = async () => {
    if (resetConfirmText !== "DELETE MY ACCOUNT") {
      toast.error("Please type 'DELETE MY ACCOUNT' to confirm");
      return;
    }
    try {
      const res = await fetch("/api/auth/me", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete account");
      window.location.href = "/login";
    } catch {
      toast.error("Failed to delete account");
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/data");
      if (!res.ok) throw new Error("Failed to fetch data");
      const { data: exportData } = await res.json();
      const jsonExport = { exportedAt: new Date().toISOString(), version: 1, data: exportData };
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
    } catch {
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      if (!importData.data) throw new Error("Invalid export file format");
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
      toast.success(
        `Imported ${imported.transactions || 0} transactions, ${imported.categories || 0} categories, ${imported.budgets || 0} budgets`
      );
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to import data. Check file format."
      );
    } finally {
      setIsImporting(false);
      if (dataFileInputRef.current) dataFileInputRef.current.value = "";
    }
  };

  // ── Keyboard navigation ────────────────────────────────────────────────────

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
        setHighlightedCurrencyIndex((p) => Math.min(p + 1, filteredCurrencies.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedCurrencyIndex((p) => Math.max(p - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredCurrencies[highlightedCurrencyIndex])
          setPendingCurrency(filteredCurrencies[highlightedCurrencyIndex].value as Currency);
        break;
      case "Escape":
        e.preventDefault();
        setCurrencyOpen(false);
        setCurrencySearch("");
        break;
    }
  };

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
        setHighlightedTimezoneIndex((p) => Math.min(p + 1, filteredTimezones.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedTimezoneIndex((p) => Math.max(p - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredTimezones[highlightedTimezoneIndex])
          setPendingTimezone(filteredTimezones[highlightedTimezoneIndex].value);
        break;
      case "Escape":
        e.preventDefault();
        setTimezoneOpen(false);
        setTimezoneSearch("");
        break;
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const timezoneOptions = useMemo(
    () => TIMEZONE_LIST.map((tz) => getTimezoneWithOffset(tz)).sort((a, b) => a.offset - b.offset),
    []
  );

  const filteredCurrencies = useMemo(() => {
    if (!currencySearch.trim()) return SUPPORTED_CURRENCIES;
    const s = currencySearch.toLowerCase();
    return SUPPORTED_CURRENCIES.filter(
      (c) => c.value.toLowerCase().includes(s) || c.label.toLowerCase().includes(s)
    );
  }, [currencySearch]);

  const filteredTimezones = useMemo(() => {
    if (!timezoneSearch.trim()) return timezoneOptions;
    const s = timezoneSearch.toLowerCase();
    return timezoneOptions.filter(
      (tz) => tz.value.toLowerCase().includes(s) || tz.label.toLowerCase().includes(s)
    );
  }, [timezoneSearch, timezoneOptions]);

  useEffect(() => {
    setHighlightedCurrencyIndex(0);
  }, [filteredCurrencies]);
  useEffect(() => {
    setHighlightedTimezoneIndex(0);
  }, [filteredTimezones]);

  const timezoneShortLabel = useMemo(() => {
    const tz = timezoneOptions.find((t) => t.value === timezone);
    if (!tz) return undefined;
    const match = tz.label.match(/\((.+?)\)/);
    return match ? match[1] : timezone.split("/").pop()?.replace("_", " ");
  }, [timezone, timezoneOptions]);

  const snapshotRowValue = snapshotEnabled ? `Daily ${snapshotTime}` : "Disabled";

  // Dev colors

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-8">
      <div ref={sentinelRef} className="h-0" />

      <SettingsPageHeader
        title="Settings"
        description="Manage your app preferences, integrations, and data."
      />

      {/* ── INTEGRATIONS ─────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionHeader label="Integrations" />
        <div className="grid grid-cols-2 gap-4 max-w-lg">
          {/* Finnhub */}
          <Link href="/settings/finnhub" className="block">
          <div
            className="rounded-xl border bg-card p-5 flex flex-col gap-3 cursor-pointer hover:border-primary/40 transition-colors h-full"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/10 shrink-0">
                <img
                  src="/logos/finnhub.png"
                  alt="Finnhub"
                  className="h-6 w-auto object-contain"
                />
              </div>
              {finnhubConfigured === null ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mt-0.5" />
              ) : finnhubConfigured ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  Not set up
                </span>
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Finnhub</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Real-time stock, crypto & metal prices
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
            >
              {finnhubConfigured ? "Manage" : "Set up"}
            </Button>
          </div>
          </Link>

          {/* Plaid */}
          <Link href="/settings/plaid" className="block">
            <div className="rounded-xl border bg-card p-5 flex flex-col gap-3 cursor-pointer hover:border-primary/40 transition-colors h-full">
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 shrink-0">
                  <img src="/logos/plaid.png" alt="Plaid" className="h-6 w-auto object-contain" />
                </div>
                {plaidConfigured === null ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mt-0.5" />
                ) : plaidConfigured ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Configured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    Not configured
                  </span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Plaid Banking</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Bank account connections & balance sync
                </p>
              </div>
              <Button variant="outline" size="sm" className="self-start">
                {plaidConfigured ? "Manage" : "Connect"}
              </Button>
            </div>
          </Link>
        </div>
      </section>

      {/* ── ACCOUNT ──────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionHeader label="Account" />
        <RowGroup>
          <ActionRow
            icon={<User className="h-4 w-4" />}
            title={user?.username || ""}
            description="Logged in"
            action={
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                Sign out
              </Button>
            }
          />
        </RowGroup>
      </section>

      {/* ── PREFERENCES ──────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionHeader label="Preferences" />
        <RowGroup>
          <NavigateRow
            icon={<DollarSign className="h-4 w-4" />}
            title="Currency"
            description="Default currency for transactions and portfolio"
            value={currency}
            onClick={() => setCurrencyOpen(true)}
          />
          <NavigateRow
            icon={<Globe className="h-4 w-4" />}
            title="Timezone"
            description="Used for accurate date handling"
            value={timezoneShortLabel}
            onClick={() => setTimezoneOpen(true)}
          />
          <ToggleRow
            icon={<Copy className="h-4 w-4" />}
            title="Auto-copy budgets"
            description="Copy last month's budgets when a new month has none set"
            id="auto-copy-budgets"
            checked={autoCopyBudgets}
            onCheckedChange={handleAutoCopyBudgetsChange}
          />
          <NavigateRow
            icon={<Clock className="h-4 w-4" />}
            title="Snapshot Schedule"
            description="Automatic daily net worth snapshots"
            value={snapshotRowValue}
            href="/settings/snapshots"
          />
        </RowGroup>
      </section>

      {/* ── CONFIGS ──────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionHeader label="Configs" />
        <RowGroup>
          <NavigateRow
            icon={<Tag className="h-4 w-4" />}
            title="Categories"
            description="Manage transaction categories and auto-categorization keywords"
            href="/settings/categories"
          />
          <NavigateRow
            icon={<FileText className="h-4 w-4" />}
            title="Import Templates"
            description="Custom CSV and Excel column mapping templates"
            href="/settings/templates"
          />
        </RowGroup>
      </section>

      {/* ── DATA ─────────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionHeader label="Data" />
        <RowGroup>
          <ActionRow
            icon={<Download className="h-4 w-4" />}
            title="Export Data"
            description="Download all transactions, categories, budgets, and portfolio data"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportData}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Export"
                )}
              </Button>
            }
          />
          <ActionRow
            icon={<Upload className="h-4 w-4" />}
            title="Import Data"
            description="Restore data from a previously exported JSON backup file"
            action={
              <>
                <input
                  ref={dataFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => dataFileInputRef.current?.click()}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Import"
                  )}
                </Button>
              </>
            }
          />
          <NavigateRow
            icon={<Trash2 className="h-4 w-4" />}
            title="Delete Account"
            description="Permanently delete your account and all associated data"
            onClick={() => setShowResetDialog(true)}
            destructive
          />
        </RowGroup>
      </section>

      {/* ── DEVELOPER (conditional) ──────────────────────────────────────── */}
      {(process.env.NODE_ENV === "development" || user?.username === "joshdev") && (
        <section className="space-y-2">
          <SectionHeader label="Developer" />
          <RowGroup>
            <NavigateRow
              icon={<Code2 className="h-4 w-4" />}
              title="Developer Tools"
              description="Snapshot history, component library, color palette"
              href="/settings/developer"
            />
          </RowGroup>
        </section>
      )}

      {/* ─── DIALOGS ─────────────────────────────────────────────────────── */}

      {/* Currency Picker Dialog */}
      <Dialog
        open={currencyOpen}
        onOpenChange={(open) => {
          setCurrencyOpen(open);
          if (open) setPendingCurrency(currency);
          else setCurrencySearch("");
        }}
      >
        <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 border-b">
            <DialogTitle>Select Currency</DialogTitle>
            <DialogDescription className="sr-only">
              Search and select your default currency
            </DialogDescription>
          </DialogHeader>
          <div className="px-3 pt-3 pb-2 border-b">
            <Input
              placeholder="Search currencies..."
              value={currencySearch}
              onChange={(e) => setCurrencySearch(e.target.value)}
              onKeyDown={handleCurrencyKeyDown}
              autoFocus
            />
          </div>
          <div ref={currencyListRef} className="max-h-[300px] overflow-y-auto p-1">
            {filteredCurrencies.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No currency found
              </div>
            ) : (
              filteredCurrencies.map((c, index) => (
                <div
                  key={c.value}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer",
                    index === highlightedCurrencyIndex && "bg-accent",
                    c.value === pendingCurrency && "bg-muted font-medium"
                  )}
                  onClick={() => setPendingCurrency(c.value as Currency)}
                  onMouseEnter={() => setHighlightedCurrencyIndex(index)}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      c.value === pendingCurrency ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="font-mono w-10">{c.value}</span>
                  <span className="flex-1 truncate text-muted-foreground">{c.label}</span>
                  <span className="text-muted-foreground">{c.symbol}</span>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="px-4 py-3 border-t">
            <Button
              variant="outline"
              onClick={() => { setCurrencyOpen(false); setCurrencySearch(""); }}
            >
              Cancel
            </Button>
            <Button onClick={handleCurrencySave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timezone Picker Dialog */}
      <Dialog
        open={timezoneOpen}
        onOpenChange={(open) => {
          setTimezoneOpen(open);
          if (open) setPendingTimezone(timezone);
          else setTimezoneSearch("");
        }}
      >
        <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 border-b">
            <DialogTitle>Select Timezone</DialogTitle>
            <DialogDescription className="sr-only">
              Search and select your timezone
            </DialogDescription>
          </DialogHeader>
          <div className="px-3 pt-3 pb-2 border-b">
            <Input
              placeholder="Search timezones..."
              value={timezoneSearch}
              onChange={(e) => setTimezoneSearch(e.target.value)}
              onKeyDown={handleTimezoneKeyDown}
              autoFocus
            />
          </div>
          <div ref={timezoneListRef} className="max-h-[300px] overflow-y-auto p-1">
            {filteredTimezones.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No timezone found
              </div>
            ) : (
              filteredTimezones.map((tz, index) => (
                <div
                  key={tz.value}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer",
                    index === highlightedTimezoneIndex && "bg-accent",
                    tz.value === pendingTimezone && "bg-muted font-medium"
                  )}
                  onClick={() => setPendingTimezone(tz.value)}
                  onMouseEnter={() => setHighlightedTimezoneIndex(index)}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      tz.value === pendingTimezone ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1">{tz.label}</span>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="px-4 py-3 border-t">
            <Button
              variant="outline"
              onClick={() => { setTimezoneOpen(false); setTimezoneSearch(""); }}
            >
              Cancel
            </Button>
            <Button onClick={handleTimezoneSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all associated data. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Your user account</li>
              <li>All transactions and import history</li>
              <li>All categories and budgets</li>
              <li>All portfolio accounts, items, and snapshots</li>
              <li>All app preferences</li>
            </ul>
            <div>
              <p className="text-sm font-medium mb-2">
                Type <code className="bg-muted px-1 py-0.5 rounded">DELETE MY ACCOUNT</code> to
                confirm:
              </p>
              <Input
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="Type here..."
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResetConfirmText("")}>Cancel</AlertDialogCancel>
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

    </div>
  );
}
