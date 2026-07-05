"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { Save, X, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
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
  invalidateBudgets,
} from "@/hooks";
import { setBudget, getSetting, setSetting, findPreviousMonthWithBudgets, copyBudgetToMonth } from "@/lib/db/client";
import type { BudgetTree, BudgetTreeItem } from "@/lib/budget/types";
import { computeEffectiveTree, parsePending } from "@/lib/budget/effective-tree";
import { BudgetTreeInputProvider, useBudgetTreeInputs } from "@/components/features/budget/budget-tree-context";
import { PeriodNavigator } from "@/components/features/budget/period-navigator";
import { BudgetSummaryHero, type AssignSuggestion } from "@/components/features/budget/budget-summary-hero";
import { BudgetTreeView } from "@/components/features/budget/budget-tree";
import { CopyPreviousMonthCard } from "@/components/features/budget/copy-previous-month-card";
import { YearlyTotalsView } from "@/components/features/budget/yearly-totals-view";
import { ItemDetailSheet, type DetailItem } from "@/components/features/budget/item-detail-sheet";
import { BudgetPageSkeleton } from "@/components/features/budget/budget-page-skeleton";

const SUGGESTION_GROUPS = ["Savings", "Goals", "Flexible Spending"];

export default function BudgetPage() {
  const now = new Date();
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");
  const [selected, setSelected] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [manage, setManage] = useState(false);

  const { formatAmount } = usePrivacy();
  const currency = useCurrency();
  const fmt = useCallback((n: number) => formatAmount(n, currency), [formatAmount, currency]);

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
    <div className="space-y-6">
      <div ref={sentinelRef} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "monthly" | "yearly")}>
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly Totals</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
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
            <Toggle pressed={manage} onPressedChange={setManage} variant="outline" size="sm" className="gap-1.5" aria-label="Manage budget structure">
              <Settings2 className="h-4 w-4" />
              Manage
            </Toggle>
          )}
        </div>
      </div>

      {viewMode === "monthly" ? (
        !tree ? (
          <BudgetPageSkeleton />
        ) : tree.groups.length === 0 ? (
          <EmptyBudget />
        ) : (
          <BudgetTreeInputProvider>
            <MonthlyContent tree={tree} year={selected.year} month={selected.month} fmt={fmt} manage={manage} />
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
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
      <p className="text-lg font-medium">No budget yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Add a group, subcategory, and item to start budgeting, or import transactions to see activity.
      </p>
    </div>
  );
}

function MonthlyContent({
  tree,
  year,
  month,
  fmt,
  manage,
}: {
  tree: BudgetTree;
  year: number;
  month: number;
  fmt: (n: number) => string;
  manage: boolean;
}) {
  const { focus } = useBudgetTreeInputs();
  const { setHasUnsavedChanges, setSaveHandler } = useUnsavedChanges();

  const [pending, setPending] = useState<Map<number, string>>(new Map());
  const [detailItem, setDetailItem] = useState<DetailItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Copy-from-previous-month state
  const [previous, setPrevious] = useState<{ year: number; month: number } | null>(null);
  const [autoCopy, setAutoCopy] = useState<boolean | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  const monthEmpty = tree.groups.every((g) => g.subcategories.every((s) => s.items.every((i) => i.planned === 0)));

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
    // Add the remaining amount to the item's current effective planned value.
    let current = 0;
    for (const g of effective.groups) for (const s of g.subcategories) for (const it of s.items) if (it.id === itemId) current = it.planned;
    setPlanned(itemId, (current + amount).toFixed(2));
    focus(itemId);
  }, [effective, setPlanned, focus]);

  // Suggested assign targets (Savings/Goals/Flexible) + overspent chips.
  const suggestions = useMemo<AssignSuggestion[]>(() => {
    const out: AssignSuggestion[] = [];
    for (const g of effective.groups) {
      if (!SUGGESTION_GROUPS.includes(g.name)) continue;
      for (const s of g.subcategories) for (const it of s.items) out.push({ itemId: it.id, label: `${g.name} › ${it.name}` });
    }
    return out.slice(0, 8);
  }, [effective]);

  const overspentChips = useMemo<AssignSuggestion[]>(() => {
    const all: { itemId: number; label: string; planned: number }[] = [];
    for (const g of effective.groups) for (const s of g.subcategories) for (const it of s.items) all.push({ itemId: it.id, label: it.name, planned: it.planned });
    return all.sort((a, b) => b.planned - a.planned).slice(0, 4).map(({ itemId, label }) => ({ itemId, label }));
  }, [effective]);

  const openDetail = useCallback((item: BudgetTreeItem) => {
    setDetailItem({
      id: item.id,
      name: item.name,
      itemType: item.itemType,
      targetAmount: item.targetAmount,
      isActive: item.isActive,
      keywords: item.keywords,
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

      {manage && (
        <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Manage mode: use each row&apos;s ⋯ menu → Item details to rename, move, set targets, archive, or delete.
        </p>
      )}

      <BudgetTreeView
        tree={effective}
        pending={pending}
        formatAmount={fmt}
        year={year}
        month={month}
        onPlannedChange={setPlanned}
        onPlannedCommit={() => { /* pending already captured; commit is a no-op until Save */ }}
        onOpenDetail={openDetail}
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

      <ItemDetailSheet item={detailItem} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
