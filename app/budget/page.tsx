"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  Wallet,
  Receipt,
  PiggyBank,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  X,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  useBudgetPageData,
  useAvailablePeriods,
  BudgetCategoryRow,
  invalidateBudgets,
} from "@/lib/hooks";
import { setBudget, getBudgetForCategory, deleteBudget, findPreviousMonthWithBudgets, copyBudgetToMonth, getSetting, setSetting } from "@/lib/db/client";
import { usePrivacy } from "@/lib/privacy-context";
import { useSetPageHeader } from "@/lib/page-header-context";
import { useUnsavedChanges } from "@/lib/unsaved-changes-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================
// Constants
// ============================================

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ============================================
// Types
// ============================================

interface PendingChange {
  monthly?: string;
  yearly?: string;
}

// ============================================
// Month Picker Component
// ============================================

function MonthPicker({
  selectedMonth,
  onMonthSelect,
  availableYears,
  availableMonthsByYear,
}: {
  selectedMonth: { year: number; month: number };
  onMonthSelect: (year: number, month: number) => void;
  availableYears: number[];
  availableMonthsByYear?: Map<number, number[]>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayYear, setDisplayYear] = useState(selectedMonth.year);

  const selectedMonthDisplay = `${MONTH_NAMES_SHORT[selectedMonth.month]} ${selectedMonth.year}`;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const yearOptions = availableYears.length > 0
    ? [...new Set([...availableYears, currentYear])].sort((a, b) => b - a)
    : [currentYear];

  const isMonthEnabled = (year: number, month: number) => {
    if (year === currentYear && month === currentMonth) return true;
    if (!availableMonthsByYear) return true;
    return availableMonthsByYear.get(year)?.includes(month) ?? false;
  };

  const handleOpenChange = (open: boolean) => {
    if (open) setDisplayYear(selectedMonth.year);
    setIsOpen(open);
  };

  const handleMonthClick = (monthIndex: number) => {
    onMonthSelect(displayYear, monthIndex);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar className="h-4 w-4" />
          {selectedMonthDisplay}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDisplayYear(y => y - 1)}
              disabled={!yearOptions.includes(displayYear - 1)}
            >
              &lt;
            </Button>
            <Select
              value={displayYear.toString()}
              onValueChange={(v) => setDisplayYear(parseInt(v))}
            >
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDisplayYear(y => y + 1)}
              disabled={!yearOptions.includes(displayYear + 1)}
            >
              &gt;
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_NAMES_SHORT.map((monthName, idx) => {
              const enabled = isMonthEnabled(displayYear, idx);
              const isSelected = selectedMonth.year === displayYear && selectedMonth.month === idx;
              return (
                <Button
                  key={monthName}
                  variant={isSelected ? "default" : "ghost"}
                  size="sm"
                  disabled={!enabled}
                  onClick={() => handleMonthClick(idx)}
                  className="h-8"
                >
                  {monthName}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// Budget Input Component (No auto-save)
// ============================================

function BudgetInput({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Allow empty string
    if (inputValue === "") {
      onChange("");
      return;
    }

    // Only allow numbers and decimal point
    if (!/^\d*\.?\d*$/.test(inputValue)) {
      return;
    }

    onChange(inputValue);
  };

  // Format to 2 decimal places on blur and trigger sync
  const handleBlur = () => {
    if (value) {
      const val = parseFloat(value);
      if (!isNaN(val)) {
        onChange(val.toFixed(2));
      }
    }
    onBlur?.();
  };

  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
      <Input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="pl-6 h-8 w-28 text-sm"
      />
    </div>
  );
}

// ============================================
// Budget Category Row Component
// ============================================

function CategoryBudgetRow({
  row,
  viewMode,
  formatAmount,
  isPrivacyMode,
  pendingChange,
  onMonthlyChange,
  onYearlyChange,
  onMonthlyBlur,
  onYearlyBlur,
}: {
  row: BudgetCategoryRow;
  viewMode: "month" | "year";
  formatAmount: (amount: number, formatter?: (n: number) => string) => string;
  isPrivacyMode: boolean;
  pendingChange?: PendingChange;
  onMonthlyChange: (categoryId: number, value: string) => void;
  onYearlyChange: (categoryId: number, value: string) => void;
  onMonthlyBlur: (categoryId: number) => void;
  onYearlyBlur: (categoryId: number) => void;
}) {
  // Get display values - use pending changes if available, otherwise use saved values
  const monthlyValue = pendingChange?.monthly !== undefined
    ? pendingChange.monthly
    : (row.monthlyBudget?.toFixed(2) ?? "");

  const yearlyValue = pendingChange?.yearly !== undefined
    ? pendingChange.yearly
    : (row.yearlyBudget?.toFixed(2) ?? "");

  const hasBudget = viewMode === "month"
    ? (row.monthlyBudget !== null || row.yearlyBudget !== null)
    : row.yearlyBudget !== null;

  // Calculate progress
  const spent = viewMode === "month" ? row.currentMonthSpending : row.yearlySpending;
  const budget = viewMode === "month" ? (row.monthlyBudget ?? 0) : (row.yearlyBudget ?? 0);
  const percentUsed = budget > 0 ? (spent / budget) * 100 : 0;
  const isOverBudget = spent > budget && budget > 0;

  const isEdited = pendingChange !== undefined;

  return (
    <div className={cn(
      "flex items-center gap-4 py-3 px-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors",
      isEdited && "bg-primary/5"
    )}>
      {/* Category Name */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{row.categoryName}</p>
        {/* Rolling balance for yearly budgets in monthly view */}
        {viewMode === "month" && row.yearlyBudget !== null && row.rollingBalance !== null && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-help">
                    {row.paceStatus === "under" && (
                      <Badge variant="outline" className="text-xs h-5 gap-1 text-green-600 border-green-600/30 bg-green-500/10">
                        <TrendingDown className="h-3 w-3" />
                        Under Pace
                      </Badge>
                    )}
                    {row.paceStatus === "over" && (
                      <Badge variant="outline" className="text-xs h-5 gap-1 text-orange-600 border-orange-600/30 bg-orange-500/10">
                        <TrendingUp className="h-3 w-3" />
                        Over Pace
                      </Badge>
                    )}
                    {row.paceStatus === "on" && (
                      <Badge variant="outline" className="text-xs h-5 gap-1 text-muted-foreground">
                        <Minus className="h-3 w-3" />
                        On Pace
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatAmount(Math.abs(row.rollingBalance), formatCurrency)}
                      {row.rollingBalance < 0 ? " borrowed" : " available"}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-1 text-xs">
                    <p className="font-medium">Rolling Balance Calculation</p>
                    <p>Yearly budget: {formatCurrency(row.yearlyBudget)}</p>
                    <p>Monthly allowance: {formatCurrency(row.monthlyAllowance ?? 0)}</p>
                    <p>YTD spent: {formatCurrency(row.ytdSpending)}</p>
                    <p className="pt-1 border-t">
                      Balance: {formatCurrency(row.rollingBalance)}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      {/* Budget Input - Monthly for month view, Yearly for year view */}
      {viewMode === "month" ? (
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Budget</span>
          <BudgetInput
            value={monthlyValue}
            onChange={(v) => onMonthlyChange(row.categoryId, v)}
            onBlur={() => onMonthlyBlur(row.categoryId)}
            placeholder="—"
            disabled={row.isSystemCategory && row.categoryName === "Uncategorized"}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Budget</span>
          <BudgetInput
            value={yearlyValue}
            onChange={(v) => onYearlyChange(row.categoryId, v)}
            onBlur={() => onYearlyBlur(row.categoryId)}
            placeholder="—"
            disabled={row.isSystemCategory && row.categoryName === "Uncategorized"}
          />
        </div>
      )}

      {/* Spending & Progress */}
      <div className="w-32 flex flex-col gap-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Spent</span>
          <span className={cn(
            "font-medium",
            isOverBudget && !isPrivacyMode && "text-red-500"
          )}>
            {formatAmount(spent, formatCurrency)}
          </span>
        </div>
        {hasBudget && (
          <>
            <Progress
              value={Math.min(percentUsed, 100)}
              className={cn(
                "h-1.5",
                isOverBudget && "[&>div]:bg-red-500"
              )}
            />
            <div className="text-[10px] text-muted-foreground text-right">
              {Math.round(percentUsed)}% of {formatAmount(budget, formatCurrency)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// Main Budget Page
// ============================================

export default function BudgetPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // State
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState({ year: currentYear, month: currentMonth });

  // Pending changes state
  const [pendingChanges, setPendingChanges] = useState<Map<number, PendingChange>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  // Unsaved changes dialog state
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // State for copy from previous month prompt
  const [previousMonthWithBudgets, setPreviousMonthWithBudgets] = useState<{ year: number; month: number } | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [autoCopyEnabled, setAutoCopyEnabled] = useState<boolean | null>(null);

  // Hooks
  const { formatAmount, isPrivacyMode } = usePrivacy();
  const availablePeriods = useAvailablePeriods();
  const { setHasUnsavedChanges, setSaveHandler } = useUnsavedChanges();
  const budgetData = useBudgetPageData(
    viewMode === "month" ? selectedMonth.year : selectedYear,
    viewMode === "month" ? selectedMonth.month : currentMonth
  );

  // Load auto-copy setting on mount
  useEffect(() => {
    getSetting("autoCopyBudgets").then(value => {
      setAutoCopyEnabled(value === "true");
    });
  }, []);

  // Check if current month is empty and find previous month with budgets
  const currentMonthHasNoBudgets = useMemo(() => {
    if (!budgetData || viewMode !== "month") return false;
    return budgetData.rows.every(row => row.monthlyBudget === null);
  }, [budgetData, viewMode]);

  // Find previous month with budgets and auto-copy if enabled
  useEffect(() => {
    if (autoCopyEnabled === null) return; // Wait for setting to load

    if (currentMonthHasNoBudgets && viewMode === "month") {
      findPreviousMonthWithBudgets(selectedMonth.year, selectedMonth.month)
        .then(async (result) => {
          if (result && autoCopyEnabled) {
            // Auto-copy silently
            await copyBudgetToMonth(result.year, result.month, selectedMonth.year, selectedMonth.month);
            invalidateBudgets();
            setPreviousMonthWithBudgets(null);
          } else {
            setPreviousMonthWithBudgets(result);
          }
        });
    } else {
      setPreviousMonthWithBudgets(null);
    }
  }, [currentMonthHasNoBudgets, viewMode, selectedMonth.year, selectedMonth.month, autoCopyEnabled]);

  // Handle copying budgets from previous month
  const handleCopyFromPrevious = useCallback(async () => {
    if (!previousMonthWithBudgets) return;

    setIsCopying(true);
    try {
      await copyBudgetToMonth(
        previousMonthWithBudgets.year,
        previousMonthWithBudgets.month,
        selectedMonth.year,
        selectedMonth.month
      );
      invalidateBudgets();
      toast.success(`Copied budgets from ${MONTH_NAMES[previousMonthWithBudgets.month]} ${previousMonthWithBudgets.year}`);
      setPreviousMonthWithBudgets(null);
    } catch (error) {
      console.error("Failed to copy budgets:", error);
      toast.error("Failed to copy budgets");
    } finally {
      setIsCopying(false);
    }
  }, [previousMonthWithBudgets, selectedMonth.year, selectedMonth.month]);

  // Handle enabling auto-copy and copying
  const handleEnableAutoCopy = useCallback(async () => {
    if (!previousMonthWithBudgets) return;

    setIsCopying(true);
    try {
      await setSetting("autoCopyBudgets", "true");
      setAutoCopyEnabled(true);
      await copyBudgetToMonth(
        previousMonthWithBudgets.year,
        previousMonthWithBudgets.month,
        selectedMonth.year,
        selectedMonth.month
      );
      invalidateBudgets();
      toast.success("Auto-copy enabled. Budgets will be copied automatically each month. You can change this in Settings > Preferences.", { duration: 6000 });
      setPreviousMonthWithBudgets(null);
    } catch (error) {
      console.error("Failed to enable auto-copy:", error);
      toast.error("Failed to enable auto-copy");
    } finally {
      setIsCopying(false);
    }
  }, [previousMonthWithBudgets, selectedMonth.year, selectedMonth.month]);

  // Period display
  const periodDisplay = viewMode === "month"
    ? `${MONTH_NAMES[selectedMonth.month]} ${selectedMonth.year}`
    : `${selectedYear}`;

  // Check for unsaved changes before navigation
  const hasUnsavedChanges = pendingChanges.size > 0;

  // Sync unsaved changes state with global context for cross-page navigation
  useEffect(() => {
    setHasUnsavedChanges(hasUnsavedChanges);
    return () => setHasUnsavedChanges(false);
  }, [hasUnsavedChanges, setHasUnsavedChanges]);

  // Handle monthly input change - just store the value, don't sync yet
  const handleMonthlyChange = useCallback((categoryId: number, value: string) => {
    setPendingChanges(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(categoryId) || {};
      newMap.set(categoryId, {
        ...existing,
        monthly: value,
      });
      return newMap;
    });
  }, []);

  // Handle yearly input change - just store the value, don't sync yet
  const handleYearlyChange = useCallback((categoryId: number, value: string) => {
    setPendingChanges(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(categoryId) || {};
      newMap.set(categoryId, {
        ...existing,
        yearly: value,
      });
      return newMap;
    });
  }, []);

  // Handle monthly blur - sync to yearly
  const handleMonthlyBlur = useCallback((categoryId: number) => {
    const pending = pendingChanges.get(categoryId);
    if (!pending?.monthly) return;

    const numValue = parseFloat(pending.monthly);
    if (isNaN(numValue)) return;

    const yearlyValue = numValue * 12;

    setPendingChanges(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(categoryId) || {};
      newMap.set(categoryId, {
        ...existing,
        yearly: yearlyValue.toFixed(2),
      });
      return newMap;
    });
  }, [pendingChanges]);

  // Handle yearly blur - sync to monthly
  const handleYearlyBlur = useCallback((categoryId: number) => {
    const pending = pendingChanges.get(categoryId);
    if (!pending?.yearly) return;

    const numValue = parseFloat(pending.yearly);
    if (isNaN(numValue)) return;

    const monthlyValue = numValue / 12;

    setPendingChanges(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(categoryId) || {};
      newMap.set(categoryId, {
        ...existing,
        monthly: monthlyValue.toFixed(2),
      });
      return newMap;
    });
  }, [pendingChanges]);

  // Save all pending changes
  const handleSave = useCallback(async () => {
    if (pendingChanges.size === 0) return;

    setIsSaving(true);
    try {
      const year = viewMode === "month" ? selectedMonth.year : selectedYear;
      const month = selectedMonth.month;

      for (const [categoryId, change] of pendingChanges.entries()) {
        // Parse string values to numbers (empty string = 0 = delete)
        const monthlyNum = change.monthly !== undefined
          ? (change.monthly === "" ? 0 : parseFloat(change.monthly))
          : null;
        const yearlyNum = change.yearly !== undefined
          ? (change.yearly === "" ? 0 : parseFloat(change.yearly))
          : null;

        // Handle monthly budget
        if (monthlyNum !== null && !isNaN(monthlyNum)) {
          if (monthlyNum === 0) {
            // Delete the monthly budget if set to 0
            const existing = await getBudgetForCategory(categoryId, year, month);
            if (existing?.id) {
              await deleteBudget(existing.id);
            }
          } else {
            // Save the monthly budget
            await setBudget(categoryId, year, month, monthlyNum);
          }
        }

        // Handle yearly budget
        if (yearlyNum !== null && !isNaN(yearlyNum)) {
          if (yearlyNum === 0) {
            // Delete the yearly budget if set to 0
            const existing = await getBudgetForCategory(categoryId, year, null);
            if (existing?.id) {
              await deleteBudget(existing.id);
            }
          } else {
            // Save the yearly budget
            await setBudget(categoryId, year, null, yearlyNum);
          }
        }
      }

      invalidateBudgets();
      toast.success("Budgets saved");
      setPendingChanges(new Map());
    } catch (error) {
      console.error("Failed to save budgets:", error);
      toast.error("Failed to save budgets");
    } finally {
      setIsSaving(false);
    }
  }, [pendingChanges, viewMode, selectedMonth, selectedYear]);

  // Cancel all pending changes
  const handleCancel = useCallback(() => {
    setPendingChanges(new Map());
  }, []);

  // Register save handler with global context for cross-page navigation
  useEffect(() => {
    setSaveHandler(() => handleSave);
    return () => setSaveHandler(null);
  }, [handleSave, setSaveHandler]);

  // Navigation with unsaved changes check
  const confirmNavigation = useCallback((action: () => void) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => action);
      setShowUnsavedDialog(true);
    } else {
      action();
    }
  }, [hasUnsavedChanges]);

  const executeNavigation = useCallback(() => {
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
    setPendingChanges(new Map());
    setShowUnsavedDialog(false);
  }, [pendingNavigation]);

  const handleSaveAndContinue = useCallback(async () => {
    await handleSave();
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
    setShowUnsavedDialog(false);
  }, [handleSave, pendingNavigation]);

  // Stable handlers for header actions
  const handleViewModeChange = useCallback((value: string) => {
    confirmNavigation(() => {
      setViewMode(value as "month" | "year");
      setPendingChanges(new Map());
    });
  }, [confirmNavigation]);

  const handleMonthSelect = useCallback((year: number, month: number) => {
    confirmNavigation(() => {
      setSelectedMonth({ year, month });
      setPendingChanges(new Map());
    });
  }, [confirmNavigation]);

  const handleYearChange = useCallback((value: string) => {
    confirmNavigation(() => {
      setSelectedYear(parseInt(value));
      setPendingChanges(new Map());
    });
  }, [confirmNavigation]);

  // Available years - always include current year
  const yearOptions = useMemo(() => {
    return [...new Set([...(availablePeriods?.years ?? []), currentYear])].sort((a, b) => b - a);
  }, [availablePeriods?.years, currentYear]);

  // Calculate summary stats
  const summary = budgetData?.summary;
  const rows = budgetData?.rows ?? [];

  const displayBudgeted = viewMode === "month"
    ? (summary?.totalMonthlyBudgeted ?? 0)
    : (summary?.totalYearlyBudgeted ?? 0);

  const displaySpent = viewMode === "month"
    ? (summary?.totalMonthlySpent ?? 0)
    : (summary?.totalYtdSpent ?? 0);

  const displayRemaining = displayBudgeted - displaySpent;
  const overallPercentage = displayBudgeted > 0 ? Math.round((displaySpent / displayBudgeted) * 100) : 0;

  // Categories with budgets over/near limit
  const categoriesWithBudgets = rows.filter(r =>
    viewMode === "month" ? (r.monthlyBudget || r.yearlyBudget) : r.yearlyBudget
  );
  const categoriesOverBudget = categoriesWithBudgets.filter(r => {
    const spent = viewMode === "month" ? r.currentMonthSpending : r.yearlySpending;
    const budget = viewMode === "month" ? (r.monthlyBudget ?? 0) : (r.yearlyBudget ?? 0);
    return budget > 0 && spent > budget;
  }).length;

  const hasChanges = pendingChanges.size > 0;

  // Header actions
  const headerActions = useMemo(() => (
    <div className="flex items-center gap-2">
      <Tabs value={viewMode} onValueChange={handleViewModeChange}>
        <TabsList className="h-8">
          <TabsTrigger value="month" className="text-xs px-3 h-6">Month</TabsTrigger>
          <TabsTrigger value="year" className="text-xs px-3 h-6">Year</TabsTrigger>
        </TabsList>
      </Tabs>
      {viewMode === "month" && (
        <MonthPicker
          selectedMonth={selectedMonth}
          onMonthSelect={handleMonthSelect}
          availableYears={availablePeriods?.years ?? []}
          availableMonthsByYear={availablePeriods?.monthsByYear}
        />
      )}
      {viewMode === "year" && (
        <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
          <SelectTrigger className="w-24 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  ), [viewMode, selectedMonth, selectedYear, availablePeriods?.years, availablePeriods?.monthsByYear, yearOptions, handleViewModeChange, handleMonthSelect, handleYearChange]);

  const sentinelRef = useSetPageHeader("Budget", headerActions);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budget</h1>
          <p className="text-muted-foreground">
            Track your spending for {periodDisplay}
          </p>
          <div ref={sentinelRef} className="h-0" />
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={handleViewModeChange}>
            <TabsList>
              <TabsTrigger value="month">Monthly</TabsTrigger>
              <TabsTrigger value="year">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
          {viewMode === "month" && (
            <MonthPicker
              selectedMonth={selectedMonth}
              onMonthSelect={handleMonthSelect}
              availableYears={availablePeriods?.years ?? []}
              availableMonthsByYear={availablePeriods?.monthsByYear}
            />
          )}
          {viewMode === "year" && (
            <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Total Budgeted</CardDescription>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(displayBudgeted, formatCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {viewMode === "month" ? "Monthly allocation" : "Yearly allocation"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Total Spent</CardDescription>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(displaySpent, formatCurrency)}
            </div>
            {displayBudgeted > 0 && (
              <>
                <Progress value={Math.min(overallPercentage, 100)} className="h-2 mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {overallPercentage}% of budget used
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Remaining</CardDescription>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              !isPrivacyMode && displayRemaining < 0 && "text-red-500",
              !isPrivacyMode && displayRemaining > 0 && "text-green-500"
            )}>
              {formatAmount(displayRemaining, formatCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {categoriesOverBudget > 0 ? (
                <span className="text-red-500">{categoriesOverBudget} over budget</span>
              ) : displayBudgeted > 0 ? (
                <span className="text-green-500">All categories on track</span>
              ) : (
                "Set budgets to track spending"
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Copy from previous month prompt */}
      {previousMonthWithBudgets && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Copy className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">No budgets set for {MONTH_NAMES[selectedMonth.month]}</p>
                <p className="text-sm text-muted-foreground">
                  Copy budget amounts from {MONTH_NAMES[previousMonthWithBudgets.month]} {previousMonthWithBudgets.year}?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleCopyFromPrevious}
                disabled={isCopying}
                size="sm"
                variant="outline"
              >
                <Copy className="h-4 w-4 mr-2" />
                {isCopying ? "Copying..." : "Copy"}
              </Button>
              <Button
                onClick={handleEnableAutoCopy}
                disabled={isCopying}
                size="sm"
              >
                {isCopying ? "Copying..." : "Always Copy"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              Set monthly and yearly budgets for each category.
              {viewMode === "month" && " Yearly budgets show rolling balance."}
            </CardDescription>
          </div>
          {hasChanges && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-1" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {!budgetData ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading...
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No categories found. Create categories first.
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((row) => (
                <CategoryBudgetRow
                  key={row.categoryId}
                  row={row}
                  viewMode={viewMode}
                  formatAmount={formatAmount}
                  isPrivacyMode={isPrivacyMode}
                  pendingChange={pendingChanges.get(row.categoryId)}
                  onMonthlyChange={handleMonthlyChange}
                  onYearlyChange={handleYearlyChange}
                  onMonthlyBlur={handleMonthlyBlur}
                  onYearlyBlur={handleYearlyBlur}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved budget changes. Would you like to save them before continuing?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <Button variant="outline" onClick={executeNavigation}>
              Discard Changes
            </Button>
            <AlertDialogAction onClick={handleSaveAndContinue}>
              Save & Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
