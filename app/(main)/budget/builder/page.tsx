"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Archive, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";
import {
  useBudgetHierarchy,
  useBudgets,
  useIncomeTotal,
  usePlannedIncome,
  setPlannedIncomeAmount,
  useAvailablePeriods,
  invalidateBudgets,
} from "@/hooks";
import { setBudget } from "@/lib/db/client";
import { parsePending } from "@/lib/budget/effective-tree";
import { PeriodNavigator } from "@/components/features/budget/period-navigator";
import { AllocationMeter } from "@/components/features/budget/builder/allocation-meter";
import { BuilderList, type BuilderGroupData } from "@/components/features/budget/builder/builder-list";
import { BudgetPageSkeleton } from "@/components/features/budget/budget-page-skeleton";
import { CategoryDetailDialog, type DetailCategory } from "@/components/features/budget/category-detail-dialog";
import { ArchivedItemsSheet } from "@/components/features/budget/manage/archived-items-sheet";

export default function BudgetBuilderPage() {
  const now = new Date();
  const [selected, setSelected] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [pending, setPending] = useState<Map<number, string>>(new Map());
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const savingRef = useRef(false);
  const [detailItem, setDetailItem] = useState<DetailCategory | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const { formatAmount } = usePrivacy();
  const currency = useCurrency();
  const fmt = useCallback(
    (n: number, showCode?: boolean) => formatAmount(n, currency, showCode),
    [formatAmount, currency]
  );
  const { setHasUnsavedChanges, setSaveHandler } = useUnsavedChanges();

  const sentinelRef = useSetPageHeader("Budget Builder");

  const periods = useAvailablePeriods();
  const availableMonthsByYear = useMemo(() => {
    const m = new Map<number, number[]>();
    if (periods?.monthsByYear) for (const [y, months] of Object.entries(periods.monthsByYear)) m.set(Number(y), months as number[]);
    return m;
  }, [periods]);

  // Source structure from the full hierarchy so brand-new empty groups/subs show.
  const hierarchy = useBudgetHierarchy(false);
  const budgetRows = useBudgets(selected.year, selected.month);
  const actualIncome = useIncomeTotal(selected.year, selected.month);
  const plannedIncome = usePlannedIncome(selected.year, selected.month);

  const savedPlanned = useMemo(() => {
    const m = new Map<number, number>();
    for (const b of budgetRows ?? []) m.set(b.budgetItemId, b.amount);
    return m;
  }, [budgetRows]);

  const groups = useMemo<BuilderGroupData[]>(() => {
    if (!hierarchy) return [];
    const categoriesByGroup = new Map<number, typeof hierarchy.subcategories>();
    for (const c of hierarchy.subcategories) {
      if (!categoriesByGroup.has(c.groupId)) categoriesByGroup.set(c.groupId, []);
      categoriesByGroup.get(c.groupId)!.push(c);
    }
    return hierarchy.groups
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((group) => ({
        group,
        categories: (categoriesByGroup.get(group.id!) ?? [])
          .sort((a, b) => a.order - b.order)
          .map((category) => ({ category, saved: savedPlanned.get(category.id!) ?? 0 })),
      }));
  }, [hierarchy, savedPlanned]);

  const assigned = useMemo(() => {
    let sum = 0;
    for (const g of groups) for (const { category, saved } of g.categories) sum += parsePending(pending.get(category.id!), saved);
    return sum;
  }, [groups, pending]);

  const incomeVal = plannedIncome ?? actualIncome ?? 0;

  useEffect(() => setPending(new Map()), [selected.year, selected.month]);

  const handleIncomeChange = useCallback(
    async (amount: number) => {
      try {
        await setPlannedIncomeAmount(selected.year, selected.month, amount);
      } catch {
        toast.error("Failed to save expected income");
      }
    },
    [selected.year, selected.month]
  );

  const setPlanned = useCallback((itemId: number, value: string) => {
    setPending((prev) => {
      const next = new Map(prev);
      next.set(itemId, value);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    const entries = Array.from(pending.entries());
    if (entries.length === 0) return;
    savingRef.current = true;
    setSaveState("saving");
    try {
      for (const [itemId, val] of entries) {
        await setBudget(itemId, selected.year, selected.month, parsePending(val, 0));
      }
      // Only clear the values we actually saved — edits made mid-save stay pending.
      setPending((prev) => {
        const next = new Map(prev);
        for (const [id, val] of entries) if (next.get(id) === val) next.delete(id);
        return next;
      });
      invalidateBudgets();
      setSaveState("saved");
    } catch {
      toast.error("Failed to save budget");
      setSaveState("idle");
    } finally {
      savingRef.current = false;
    }
  }, [pending, selected.year, selected.month]);

  // Autosave: debounce a beat after the last edit, then flush.
  useEffect(() => {
    if (pending.size === 0) return;
    const t = setTimeout(() => { void handleSave(); }, 1000);
    return () => clearTimeout(t);
  }, [pending, handleSave]);

  // Fade the "All changes saved" state back to the quiet idle dot.
  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 3000);
    return () => clearTimeout(t);
  }, [saveState]);

  useEffect(() => {
    setHasUnsavedChanges(pending.size > 0);
    setSaveHandler(pending.size > 0 ? () => handleSave : null);
    return () => { setHasUnsavedChanges(false); setSaveHandler(null); };
  }, [pending.size, handleSave, setHasUnsavedChanges, setSaveHandler]);

  const openDetail = useCallback((category: DetailCategory) => {
    setDetailItem(category);
    setDetailOpen(true);
  }, []);

  const loading =
    hierarchy === undefined || budgetRows === undefined || actualIncome === undefined || plannedIncome === undefined;

  return (
    <div className="space-y-5 p-6">
      <div ref={sentinelRef} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/budget">Budget</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Builder</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <SaveStatus saving={saveState === "saving" || pending.size > 0} justSaved={saveState === "saved"} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setArchivedOpen(true)}>
            <Archive className="h-4 w-4" /> Archived
          </Button>
          <PeriodNavigator
            viewMode="month"
            selectedMonth={selected}
            selectedYear={selected.year}
            availableYears={periods?.years ?? []}
            availableMonthsByYear={availableMonthsByYear}
            onMonthSelect={(year, month) => setSelected({ year, month })}
            onYearChange={() => {}}
          />
        </div>
      </div>

      {loading ? (
        <BudgetPageSkeleton />
      ) : (
        <>
          <AllocationMeter
            income={incomeVal}
            assigned={assigned}
            formatAmount={fmt}
            onIncomeChange={handleIncomeChange}
          />
          <BuilderList
            groups={groups}
            pending={pending}
            formatAmount={fmt}
            onPlannedChange={setPlanned}
            onOpenDetail={openDetail}
          />
        </>
      )}

      <CategoryDetailDialog category={detailItem} open={detailOpen} onOpenChange={setDetailOpen} />
      <ArchivedItemsSheet open={archivedOpen} onOpenChange={setArchivedOpen} />
    </div>
  );
}

/** Quiet Docs-style save indicator next to the breadcrumb: faint "Saved" when
 *  idle, a slow spinner while (auto)saving, and a soft green "All changes
 *  saved" pulse that fades back to idle. */
function SaveStatus({ saving, justSaved }: { saving: boolean; justSaved: boolean }) {
  return (
    <span
      className={cn(
        "flex select-none items-center gap-1.5 text-xs transition-colors duration-500",
        saving ? "text-muted-foreground" : justSaved ? "text-primary" : "text-muted-foreground/50"
      )}
      aria-live="polite"
    >
      {saving ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin [animation-duration:1.5s]" /> Saving…
        </>
      ) : justSaved ? (
        <>
          <CheckCircle2 className="h-3 w-3 animate-pulse" /> All changes saved
        </>
      ) : (
        <>• Saved</>
      )}
    </span>
  );
}
