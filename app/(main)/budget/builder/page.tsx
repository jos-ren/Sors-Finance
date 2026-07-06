"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Save, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ItemDetailDialog, type DetailItem } from "@/components/features/budget/item-detail-dialog";

export default function BudgetBuilderPage() {
  const now = new Date();
  const [selected, setSelected] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [pending, setPending] = useState<Map<number, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [detailItem, setDetailItem] = useState<DetailItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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
    const subsByGroup = new Map<number, typeof hierarchy.subcategories>();
    for (const s of hierarchy.subcategories) {
      if (!subsByGroup.has(s.groupId)) subsByGroup.set(s.groupId, []);
      subsByGroup.get(s.groupId)!.push(s);
    }
    const itemsBySub = new Map<number, typeof hierarchy.items>();
    for (const i of hierarchy.items) {
      if (!itemsBySub.has(i.subcategoryId)) itemsBySub.set(i.subcategoryId, []);
      itemsBySub.get(i.subcategoryId)!.push(i);
    }
    return hierarchy.groups
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((group) => ({
        group,
        subs: (subsByGroup.get(group.id!) ?? [])
          .sort((a, b) => a.order - b.order)
          .map((sub) => ({
            sub,
            items: (itemsBySub.get(sub.id!) ?? [])
              .sort((a, b) => a.order - b.order)
              .map((item) => ({ item, saved: savedPlanned.get(item.id!) ?? 0 })),
          })),
      }));
  }, [hierarchy, savedPlanned]);

  const assigned = useMemo(() => {
    let sum = 0;
    for (const g of groups) for (const s of g.subs) for (const { item, saved } of s.items) sum += parsePending(pending.get(item.id!), saved);
    return sum;
  }, [groups, pending]);

  const incomeVal = income ?? 0;
  const left = incomeVal - assigned;

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

  const openDetail = useCallback((item: DetailItem) => {
    setDetailItem(item);
    setDetailOpen(true);
  }, []);

  const loading = hierarchy === undefined || budgetRows === undefined || income === undefined;

  return (
    <div className="space-y-5 p-6 pb-24">
      <div ref={sentinelRef} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Link href="/budget"><ArrowLeft className="h-4 w-4" /> Back to budget</Link>
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

      {loading ? (
        <BudgetPageSkeleton />
      ) : (
        <>
          <AllocationMeter income={incomeVal} assigned={assigned} formatAmount={fmt} />
          <BuilderList
            groups={groups}
            income={incomeVal}
            leftToAssign={left}
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

      <ItemDetailDialog item={detailItem} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
