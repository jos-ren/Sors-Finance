"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BankSourceBadge } from "@/components/features/layout/bank-source-badge";
import { BudgetItemPicker, fromPickerValue, toPickerValue, type PickerValue } from "@/components/features/budget/budget-item-picker";
import { ProjectMenu } from "@/components/features/projects/project-menu";
import { useCategories, useTransactions, updateTransaction, invalidateTransactions } from "@/hooks";
import { useBudgetHierarchy } from "@/hooks/use-budget";
import { useProjects, setTransactionsProject } from "@/hooks/use-projects";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { cn } from "@/lib/utils";
import type { DbTransaction } from "@/lib/db/types";
import { TransactionDetailLines, accountLabel, useAccountLookup } from "./transaction-details";

/**
 * Review of transactions that rules just categorized (after an import, or after
 * refreshing the inbox). Rows are already saved as reviewed; this is the chance
 * to correct a category or set a project before they disappear into the ledger.
 * Rows are grouped by the category they were given, and stay in that group when
 * edited so the list does not jump under the cursor.
 */
export function AutoCategorizedDialog({
  open,
  onOpenChange,
  transactionIds,
  title = "Review auto-categorized transactions",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionIds: number[];
  title?: string;
}) {
  const transactions = useTransactions();
  const categories = useCategories();
  const hierarchy = useBudgetHierarchy(true);
  const projects = useProjects();
  const accountLookup = useAccountLookup();
  const { formatAmount } = usePrivacy();
  const currency = useCurrency();
  const [busy, setBusy] = useState<Set<number>>(new Set());
  // Category name each row was first shown under, so edits do not move it between groups.
  const [baseline, setBaseline] = useState<Map<number, string>>(new Map());

  const idSet = useMemo(() => new Set(transactionIds), [transactionIds]);
  const rows = useMemo(
    () =>
      (transactions ?? [])
        .filter((t) => t.id != null && idSet.has(t.id))
        .sort((a, b) => b.date.getTime() - a.date.getTime()),
    [transactions, idSet]
  );

  const categoryName = useMemo(() => {
    const items = new Map((hierarchy?.subcategories ?? []).map((s) => [s.id, s.name]));
    const system = new Map((categories ?? []).map((c) => [c.id, c.name]));
    return (t: DbTransaction) =>
      (t.budgetItemId != null ? items.get(t.budgetItemId) : t.categoryId != null ? system.get(t.categoryId) : undefined) ??
      "Uncategorized";
  }, [hierarchy, categories]);

  // Remember the starting group once names are available (state set during render, guarded).
  if (hierarchy && categories && rows.some((t) => !baseline.has(t.id!))) {
    const next = new Map(baseline);
    for (const t of rows) if (!next.has(t.id!)) next.set(t.id!, categoryName(t));
    setBaseline(next);
  }

  const groups = useMemo(() => {
    const byName = new Map<string, DbTransaction[]>();
    for (const t of rows) {
      const name = baseline.get(t.id!) ?? categoryName(t);
      byName.set(name, [...(byName.get(name) ?? []), t]);
    }
    return [...byName.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [rows, baseline, categoryName]);

  const withBusy = async (id: number, run: () => Promise<void>, failure: string) => {
    setBusy((prev) => new Set(prev).add(id));
    try {
      await run();
    } catch {
      toast.error(failure);
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Clearing the category sends the row back to the inbox; picking one keeps it reviewed.
  const changeCategory = (t: DbTransaction, value: PickerValue) =>
    withBusy(
      t.id!,
      async () => {
        await updateTransaction(t.id!, {
          ...fromPickerValue(value),
          reviewStatus: value ? "reviewed" : "pending",
          conflictCategories: null,
        });
        invalidateTransactions();
      },
      "Failed to change category"
    );

  const changeProject = (t: DbTransaction, projectId: number | null) =>
    withBusy(t.id!, async () => void (await setTransactionsProject([t.id!], projectId)), "Failed to set project");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {rows.length} transaction{rows.length === 1 ? "" : "s"} matched your keywords and were saved as reviewed.
            Change a category or add a project if one looks wrong.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-2 min-h-0 flex-1 space-y-5 overflow-y-auto px-2">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            groups.map(([name, items]) => (
              <section key={name}>
                <h3 className="sticky top-0 z-10 flex items-baseline gap-2 bg-background py-1 text-sm font-semibold">
                  {name}
                  <span className="text-xs font-normal text-muted-foreground">{items.length}</span>
                </h3>
                <div className="divide-y rounded-lg border">
                  {items.map((t) => (
                    <div key={t.id} className={cn("flex items-center gap-3 px-3 py-2.5", busy.has(t.id!) && "opacity-60")}>
                      <BankSourceBadge
                        source={t.source}
                        sourceMethod={(t.sourceMethod ?? undefined) as "Plaid" | "CSV" | "Manual" | undefined}
                        sourceAccountName={accountLabel(t, accountLookup) ?? undefined}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="truncate text-sm font-medium">{t.description}</p>
                        <TransactionDetailLines transaction={t} lookup={accountLookup} showDate />
                      </div>
                      <p
                        className={cn(
                          "w-28 shrink-0 text-right text-sm font-medium tabular-nums",
                          t.amountIn > 0 && "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {t.amountIn > 0
                          ? `+${formatAmount(t.amountIn, currency, false)}`
                          : `-${formatAmount(t.amountOut, currency, false)}`}
                      </p>
                      <ProjectMenu
                        projects={projects ?? []}
                        currentId={t.projectId ?? null}
                        disabled={busy.has(t.id!)}
                        onSelect={(projectId) => changeProject(t, projectId)}
                      />
                      <div className="w-[116px] shrink-0">
                        <BudgetItemPicker
                          variant="badge"
                          className="w-full justify-between"
                          value={toPickerValue(t.categoryId, t.budgetItemId)}
                          onChange={(v) => changeCategory(t, v)}
                          placeholder="Select category"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
