"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { useCategories, useTransactionsByMonth, updateTransaction } from "@/hooks";
import { useProjects } from "@/hooks/use-projects";
import { isSeparateProject } from "@/lib/budget/classify";
import type { DbTransaction } from "@/lib/db/types";
import { fromPickerValue, type PickerValue } from "@/components/features/budget/budget-item-picker";
import { TransactionListCard } from "@/components/features/transactions/transaction-list-card";
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
            {MONTH_NAMES[month]} {year} · money out with no category
          </p>
        </div>
        <span className="text-xl font-semibold tabular-nums">{fmt(total)}</span>
      </div>

      <TransactionListCard
        transactions={transactions}
        emptyText="Everything this month has a category."
        pickerPlaceholder="Select category"
        showCurrentCategory={false}
        movingId={movingId}
        onCategoryChange={assign}
      />
    </div>
  );
}
