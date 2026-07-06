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
import { useBudgetTree, useAvailablePeriods, invalidateBudgets } from "@/hooks";
import { setBudget } from "@/lib/db/client";
import { computeEffectiveTree, parsePending } from "@/lib/budget/effective-tree";
import { PeriodNavigator } from "@/components/features/budget/period-navigator";
import { AllocationMeter } from "@/components/features/budget/builder/allocation-meter";
import { AllocationItemRow } from "@/components/features/budget/builder/allocation-item-row";
import { BudgetPageSkeleton } from "@/components/features/budget/budget-page-skeleton";

export default function BudgetBuilderPage() {
  const now = new Date();
  const [selected, setSelected] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [pending, setPending] = useState<Map<number, string>>(new Map());
  const [saving, setSaving] = useState(false);

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

  const rawTree = useBudgetTree(selected.year, selected.month);
  const effective = useMemo(() => (rawTree ? computeEffectiveTree(rawTree, pending) : undefined), [rawTree, pending]);

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

  const income = effective?.summary.incomeActual ?? 0;
  const assigned = effective?.summary.totalBudgeted ?? 0;
  const left = income - assigned;

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

      {!effective ? (
        <BudgetPageSkeleton />
      ) : effective.groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <p className="text-lg font-medium">Nothing to allocate yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Create a budget on the Budget page first, then come back to allocate top-down.</p>
        </div>
      ) : (
        <>
          <AllocationMeter income={income} assigned={assigned} formatAmount={fmt} />

          <div className="space-y-4">
            {effective.groups.map((group) => {
              const groupPct = income > 0 ? (group.planned / income) * 100 : 0;
              return (
                <div key={group.id} className="overflow-hidden rounded-xl border bg-card">
                  <div className="border-b px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{group.name}</span>
                      <span className="flex items-center gap-2 text-sm tabular-nums">
                        <span className="font-medium">{fmt(group.planned)}</span>
                        {income > 0 && <span className="text-xs text-muted-foreground">{groupPct.toFixed(0)}%</span>}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, groupPct)}%` }} />
                    </div>
                  </div>

                  <div className="space-y-3 px-4 py-3">
                    {group.subcategories.map((sub) => (
                      <div key={sub.id}>
                        {sub.items.length > 1 && (
                          <p className="pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{sub.name}</p>
                        )}
                        {sub.items.map((item) => (
                          <AllocationItemRow
                            key={item.id}
                            item={item}
                            income={income}
                            leftToAssign={left}
                            pendingValue={pending.get(item.id)}
                            dirty={pending.has(item.id)}
                            formatAmount={fmt}
                            onChange={(v) => setPlanned(item.id, v)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
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
    </div>
  );
}
