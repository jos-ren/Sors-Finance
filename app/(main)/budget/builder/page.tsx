"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Save, X, Archive } from "lucide-react";
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
import { useBudgetHierarchy, useBudgets, useIncomeTotal, useAvailablePeriods, invalidateBudgets } from "@/hooks";
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
  const [saving, setSaving] = useState(false);
  const [detailItem, setDetailItem] = useState<DetailCategory | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const { formatAmount } = usePrivacy();
  const currency = useCurrency();
  const fmt = useCallback((n: number) => formatAmount(n, currency), [formatAmount, currency]);
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
  const income = useIncomeTotal(selected.year, selected.month);

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

  const incomeVal = income ?? 0;

  useEffect(() => setPending(new Map()), [selected.year, selected.month]);

  const setPlanned = useCallback((itemId: number, value: string) => {
    setPending((prev) => {
      const next = new Map(prev);
      next.set(itemId, value);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      for (const [itemId, val] of pending.entries()) {
        await setBudget(itemId, selected.year, selected.month, parsePending(val, 0));
      }
      setPending(new Map());
      invalidateBudgets();
      toast.success("Budget saved");
    } catch {
      toast.error("Failed to save budget");
    } finally {
      setSaving(false);
    }
  }, [pending, selected.year, selected.month]);

  useEffect(() => {
    setHasUnsavedChanges(pending.size > 0);
    setSaveHandler(pending.size > 0 ? () => handleSave : null);
    return () => { setHasUnsavedChanges(false); setSaveHandler(null); };
  }, [pending.size, handleSave, setHasUnsavedChanges, setSaveHandler]);

  const openDetail = useCallback((category: DetailCategory) => {
    setDetailItem(category);
    setDetailOpen(true);
  }, []);

  const loading = hierarchy === undefined || budgetRows === undefined || income === undefined;

  return (
    <div className="space-y-5 p-6 pb-24">
      <div ref={sentinelRef} />

      <div className="flex flex-wrap items-center justify-between gap-3">
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
          <AllocationMeter income={incomeVal} assigned={assigned} formatAmount={fmt} />
          <BuilderList
            groups={groups}
            income={incomeVal}
            pending={pending}
            formatAmount={fmt}
            onPlannedChange={setPlanned}
            onOpenDetail={openDetail}
          />
        </>
      )}

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
      <ArchivedItemsSheet open={archivedOpen} onOpenChange={setArchivedOpen} />
    </div>
  );
}
