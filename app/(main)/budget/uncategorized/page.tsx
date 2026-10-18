"use client";

import { Fragment, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { useCategories, useTransactionsByMonth, updateTransaction } from "@/hooks";
import { useProjects } from "@/hooks/use-projects";
import { isSeparateProject } from "@/lib/budget/classify";
import type { DbTransaction } from "@/lib/db/types";
import { BudgetItemPicker, fromPickerValue, type PickerValue } from "@/components/features/budget/budget-item-picker";
import { EditTransactionDialog } from "@/components/features/transactions/edit-transaction-dialog";
import {
  TransactionDetailLines,
  accountLabel,
  dayLabel,
  useAccountLookup,
} from "@/components/features/transactions/transaction-details";
import { BankSourceBadge } from "@/components/features/layout/bank-source-badge";
import { SYSTEM_CATEGORIES } from "@/lib/db/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// useSearchParams needs a Suspense boundary on a statically rendered route.
export default function UncategorizedPage() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-40 w-full" /></div>}>
      <UncategorizedContent />
    </Suspense>
  );
}

/**
 * The month's uncategorized money out: the rows behind the "Uncategorized" line
 * on the budget Sankey. Same definition as the budget tree's `uncategorizedOut`
 * (no budget category, not Income or Excluded, money out, not in a separately
 * funded project), so the total here matches the chart.
 */
function UncategorizedContent() {
  const searchParams = useSearchParams();
  const now = new Date();
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth()), 10);

  const { formatAmount } = usePrivacy();
  const currency = useCurrency();
  const fmt = (n: number) => formatAmount(n, currency);

  const monthTransactions = useTransactionsByMonth(year, month);
  const categories = useCategories();
  const projects = useProjects();
  const accountLookup = useAccountLookup();
  const [editingTransaction, setEditingTransaction] = useState<DbTransaction | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);

  const transactions = useMemo(() => {
    if (!monthTransactions || !categories || !projects) return undefined;
    const uncategorizedId = categories.find((c) => c.name === SYSTEM_CATEGORIES.UNCATEGORIZED)?.id;
    const projectById = new Map(projects.map((p) => [p.id, p]));
    return monthTransactions
      .filter(
        (t) =>
          t.budgetItemId == null &&
          (t.categoryId == null || t.categoryId === uncategorizedId) &&
          t.amountOut > 0 &&
          !(t.projectId != null && isSeparateProject(projectById.get(t.projectId)))
      )
      .sort(
        (a, b) =>
          b.date.getTime() - a.date.getTime() || (b.transactedAt?.getTime() ?? 0) - (a.transactedAt?.getTime() ?? 0)
      );
  }, [monthTransactions, categories, projects]);

  const total = transactions?.reduce((a, t) => a + t.amountOut, 0) ?? 0;

  /** Give the row a category; it leaves this list because it is no longer uncategorized. */
  const assign = async (t: DbTransaction, value: PickerValue) => {
    if (!value || t.id == null) return;
    setMovingId(t.id);
    try {
      // Locked so keyword re-matching never moves it back; reviewed so it also leaves the inbox
      await updateTransaction(t.id, {
        ...fromPickerValue(value),
        categoryLocked: true,
        reviewStatus: "reviewed",
        conflictCategories: null,
      });
      toast.success("Transaction categorized");
    } catch {
      toast.error("Failed to categorize transaction");
    } finally {
      setMovingId(null);
    }
  };

  return (
    <div className="space-y-5 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/budget?year=${year}&month=${month}`}>Budget</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Uncategorized</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Uncategorized</h1>
          <p className="text-sm text-muted-foreground">
            {MONTH_NAMES[month]} {year} · {transactions?.length ?? 0} transaction(s) without a category
          </p>
        </div>
        <span className="text-xl font-semibold tabular-nums">{fmt(total)}</span>
      </div>

      <EditTransactionDialog
        open={editingTransaction !== null}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
        transaction={editingTransaction}
      />

      <Card>
        <CardContent className="p-0">
          {!transactions ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : transactions.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Everything this month has a category.</p>
          ) : (
            <ul className="divide-y">
              {transactions.map((t, i) => {
                const showDayHeader = i === 0 || dayLabel(transactions[i - 1].date) !== dayLabel(t.date);
                return (
                  <Fragment key={t.id}>
                    {showDayHeader && (
                      <li className="bg-amber-100/30 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground dark:bg-amber-950/20">
                        {dayLabel(t.date)}
                      </li>
                    )}
                    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="shrink-0">
                        <BankSourceBadge
                          source={t.source}
                          sourceMethod={(t.sourceMethod ?? undefined) as "Plaid" | "CSV" | "Manual" | undefined}
                          sourceAccountName={accountLabel(t, accountLookup) ?? undefined}
                          size="sm"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="truncate text-sm">{t.description}</p>
                        <TransactionDetailLines transaction={t} lookup={accountLookup} />
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm tabular-nums">{fmt(t.amountOut)}</span>
                        {movingId === t.id ? (
                          <Loader2 className="mx-2 h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <BudgetItemPicker
                            variant="badge"
                            allowCreate
                            value={null}
                            onChange={(v) => assign(t, v)}
                            placeholder="Select category"
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => setEditingTransaction(t)}
                          aria-label={`Edit ${t.description}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  </Fragment>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
