"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Save, X, PencilLine, CalendarRange, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";
import {
  useBudgetTree,
  useYearlyBudgetSummary,
  useAvailablePeriods,
  useTransactions,
  invalidateBudgets,
} from "@/hooks";
import { setBudget, getSetting, setSetting, findPreviousMonthWithBudgets, copyBudgetToMonth, seedDefaultBudget } from "@/lib/db/client";
import { invalidateBudgetHierarchy } from "@/hooks/use-budget";
import type { BudgetTree, BudgetTreeCategory } from "@/lib/budget/types";
import { computeEffectiveTree, parsePending } from "@/lib/budget/effective-tree";
import { BudgetTreeInputProvider, useBudgetTreeInputs } from "@/components/features/budget/budget-tree-context";
import { PeriodNavigator } from "@/components/features/budget/period-navigator";
import { BudgetSummaryHero, type AssignSuggestion } from "@/components/features/budget/budget-summary-hero";
import { BudgetTreeView } from "@/components/features/budget/budget-tree";
import { CopyPreviousMonthCard } from "@/components/features/budget/copy-previous-month-card";
import { YearlyTotalsView } from "@/components/features/budget/yearly-totals-view";
import { CategoryDetailDialog, type DetailCategory } from "@/components/features/budget/category-detail-dialog";
import { BudgetPageSkeleton } from "@/components/features/budget/budget-page-skeleton";

const SUGGESTION_GROUPS = ["Savings", "Goals", "Flexible Spending"];

export default function BudgetPage() {
  const now = new Date();
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");
  const [selected, setSelected] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const { formatAmount } = usePrivacy();
  const currency = useCurrency();
  const fmt = useCallback((n: number) => formatAmount(n, currency), [formatAmount, currency]);
  const fmtShort = useCallback((n: number) => formatAmount(n, currency, false), [formatAmount, currency]);

  const sentinelRef = useSetPageHeader("Budget");

  const periods = useAvailablePeriods();
  const availableYears = periods?.years ?? [];
  const availableMonthsByYear = useMemo(() => {
    const m = new Map<number, number[]>();
    if (periods?.monthsByYear) for (const [y, months] of Object.entries(periods.monthsByYear)) m.set(Number(y), months as number[]);
    return m;
  }, [periods]);

  const tree = useBudgetTree(selected.year, selected.month);
  const yearly = useYearlyBudgetSummary(selectedYear);

  return (
    <div className="space-y-6 p-6">
      <div ref={sentinelRef} />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <PeriodNavigator
          viewMode={viewMode === "monthly" ? "month" : "year"}
          selectedMonth={selected}
          selectedYear={selectedYear}
          availableYears={availableYears}
          availableMonthsByYear={availableMonthsByYear}
          onMonthSelect={(year, month) => setSelected({ year, month })}
          onYearChange={(v) => setSelectedYear(parseInt(v, 10))}
        />
        {viewMode === "monthly" && (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/budget/builder">
              <PencilLine className="h-4 w-4" />
              Edit Budget
            </Link>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setViewMode((m) => (m === "monthly" ? "yearly" : "monthly"))}
        >
          {viewMode === "monthly" ? (
            <>
              <CalendarRange className="h-4 w-4" />
              View Yearly
            </>
          ) : (
            <>
              <CalendarDays className="h-4 w-4" />
              View Monthly
            </>
          )}
        </Button>
      </div>

      {viewMode === "monthly" ? (
        !tree ? (
          <BudgetPageSkeleton />
        ) : tree.groups.length === 0 ? (
          <EmptyBudget />
        ) : (
          <BudgetTreeInputProvider>
            <MonthlyContent tree={tree} year={selected.year} month={selected.month} fmt={fmt} fmtShort={fmtShort} />
          </BudgetTreeInputProvider>
        )
      ) : !yearly ? (
        <BudgetPageSkeleton />
      ) : yearly.groups.length === 0 ? (
        <EmptyBudget />
      ) : (
        <YearlyTotalsView summary={yearly} formatAmount={fmt} />
      )}
    </div>
  );
}

function EmptyBudget() {
  const [seeding, setSeeding] = useState(false);
  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDefaultBudget();
      invalidateBudgetHierarchy();
      toast.success("Starter budget created");
    } catch {
      toast.error("Failed to create starter budget");
    } finally {
      setSeeding(false);
    }
  };
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <p className="text-lg font-medium">No budget yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Start with a ready-made zero-based budget you can tweak, or turn on Manage mode to build your own.
      </p>
      <Button onClick={handleSeed} disabled={seeding}>
        {seeding ? "Creating…" : "Create starter budget"}
      </Button>
    </div>
  );
}

function MonthlyContent({
  tree,
  year,
  month,
  fmt,
  fmtShort,
}: {
  tree: BudgetTree;
  year: number;
  month: number;
  fmt: (n: number) => string;
  fmtShort: (n: number) => string;
}) {
  const { focus } = useBudgetTreeInputs();
  const { setHasUnsavedChanges, setSaveHandler } = useUnsavedChanges();

  const [pending, setPending] = useState<Map<number, string>>(new Map());
  const [detailItem, setDetailItem] = useState<DetailCategory | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Copy-from-previous-month state
  const [previous, setPrevious] = useState<{ year: number; month: number } | null>(null);
  const [autoCopy, setAutoCopy] = useState<boolean | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  const monthEmpty = tree.groups.every((g) => g.categories.every((c) => c.planned === 0));

  // Transactions for the period, grouped by category, so the tree can show
  // each category's transactions nested underneath it (desc + amount only).
  const { start: periodStart, end: periodEnd } = useMemo(
    () => ({ start: new Date(year, month, 1), end: new Date(year, month + 1, 0, 23, 59, 59) }),
    [year, month]
  );
  const monthTransactions = useTransactions({ startDate: periodStart, endDate: periodEnd });
  const transactionsByCategory = useMemo(() => {
    const map = new Map<number, { id: number; description: string; amount: number; date: Date }[]>();
    for (const t of monthTransactions ?? []) {
      if (t.budgetItemId == null) continue;
      if (!map.has(t.budgetItemId)) map.set(t.budgetItemId, []);
      map.get(t.budgetItemId)!.push({ id: t.id!, description: t.description, amount: t.amountOut - t.amountIn, date: t.date });
    }
    return map;
  }, [monthTransactions]);

  useEffect(() => {
    getSetting("autoCopyBudgets").then((v) => setAutoCopy(v === "true"));
  }, []);

  useEffect(() => {
    if (autoCopy === null) return;
    if (!monthEmpty) {
      setPrevious(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const prev = await findPreviousMonthWithBudgets(year, month);
      if (cancelled) return;
      if (prev && autoCopy) {
        await copyBudgetToMonth(prev.year, prev.month, year, month);
        invalidateBudgets();
      } else {
        setPrevious(prev);
      }
    })();
    return () => { cancelled = true; };
  }, [autoCopy, monthEmpty, year, month]);

  const effective = useMemo(() => computeEffectiveTree(tree, pending), [tree, pending]);

  // Reset pending when the period changes.
  useEffect(() => {
    setPending(new Map());
  }, [year, month]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const entries = [...pending.entries()];
      for (const [itemId, val] of entries) {
        await setBudget(itemId, year, month, parsePending(val, 0));
      }
      setPending(new Map());
      invalidateBudgets();
      toast.success("Budget saved");
    } catch {
      toast.error("Failed to save budget");
    } finally {
      setSaving(false);
    }
  }, [pending, year, month]);

  // Unsaved-changes guard.
  useEffect(() => {
    setHasUnsavedChanges(pending.size > 0);
    setSaveHandler(pending.size > 0 ? () => handleSave : null);
    return () => { setHasUnsavedChanges(false); setSaveHandler(null); };
  }, [pending.size, handleSave, setHasUnsavedChanges, setSaveHandler]);

  const setPlanned = useCallback((itemId: number, value: string) => {
    setPending((prev) => {
      const next = new Map(prev);
      next.set(itemId, value);
      return next;
    });
  }, []);

  const assignRemaining = useCallback((itemId: number, amount: number) => {
    // Add the remaining amount to the category's current effective planned value.
    let current = 0;
    for (const g of effective.groups) for (const c of g.categories) if (c.id === itemId) current = c.planned;
    setPlanned(itemId, (current + amount).toFixed(2));
    focus(itemId);
  }, [effective, setPlanned, focus]);

  // Suggested assign targets (Savings/Goals/Flexible) + overspent chips.
  const suggestions = useMemo<AssignSuggestion[]>(() => {
    const out: AssignSuggestion[] = [];
    for (const g of effective.groups) {
      if (!SUGGESTION_GROUPS.includes(g.name)) continue;
      for (const c of g.categories) out.push({ itemId: c.id, label: `${g.name} › ${c.name}` });
    }
    return out.slice(0, 8);
  }, [effective]);

  const overspentChips = useMemo<AssignSuggestion[]>(() => {
    const all: { itemId: number; label: string; planned: number }[] = [];
    for (const g of effective.groups) for (const c of g.categories) all.push({ itemId: c.id, label: c.name, planned: c.planned });
    return all.sort((a, b) => b.planned - a.planned).slice(0, 4).map(({ itemId, label }) => ({ itemId, label }));
  }, [effective]);

  const openDetail = useCallback((category: BudgetTreeCategory) => {
    setDetailItem({
      id: category.id,
      name: category.name,
      itemType: category.itemType,
      targetAmount: category.targetAmount,
      isActive: category.isActive,
      keywords: category.keywords,
    });
    setDetailOpen(true);
  }, []);

  return (
    <div className="space-y-4 pb-24">
      <BudgetSummaryHero
        tree={effective}
        formatAmount={fmt}
        suggestions={suggestions}
        overspentChips={overspentChips}
        onAssignRemaining={assignRemaining}
        onFocusItem={focus}
      />

      {previous && monthEmpty && (
        <CopyPreviousMonthCard
          previous={previous}
          isCopying={isCopying}
          onCopy={async () => {
            setIsCopying(true);
            try {
              await copyBudgetToMonth(previous.year, previous.month, year, month);
              invalidateBudgets();
              setPrevious(null);
              toast.success("Budget copied");
            } finally {
              setIsCopying(false);
            }
          }}
          onAlwaysCopy={async () => {
            setIsCopying(true);
            try {
              await setSetting("autoCopyBudgets", "true");
              setAutoCopy(true);
              await copyBudgetToMonth(previous.year, previous.month, year, month);
              invalidateBudgets();
              setPrevious(null);
              toast.success("Auto-copy enabled");
            } finally {
              setIsCopying(false);
            }
          }}
        />
      )}

      <BudgetTreeView
        tree={effective}
        formatAmountShort={fmtShort}
        year={year}
        month={month}
        onOpenDetail={openDetail}
        transactionsByCategory={transactionsByCategory}
      />

      {/* Save/Cancel FAB */}
      {pending.size > 0 && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border bg-card p-1.5 shadow-lg animate-in slide-in-from-bottom-4">
          <span className="px-3 text-sm text-muted-foreground">{pending.size} unsaved</span>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setPending(new Map())} disabled={saving}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button size="sm" className={cn("gap-1.5 rounded-full")} onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}

      <CategoryDetailDialog category={detailItem} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
