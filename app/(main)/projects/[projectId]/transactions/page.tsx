"use client";

import { Suspense, use, useMemo, useState } from "react";
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
import { useTransactions, updateTransaction } from "@/hooks";
import { useProject } from "@/hooks/use-projects";
import { fromPickerValue, type PickerValue } from "@/components/features/budget/budget-item-picker";
import { TransactionListCard } from "@/components/features/transactions/transaction-list-card";
import type { DbTransaction } from "@/lib/db/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** `?category=<key>` (the project breakdown's key: "item:<id>", "system:<id>" or "uncategorized") or `?month=<year>-<0-based month>`. */
function matches(t: DbTransaction, category: string | null, month: string | null): boolean {
  if (month) {
    return `${t.date.getFullYear()}-${t.date.getMonth()}` === month;
  }
  if (category === "uncategorized") return t.budgetItemId == null && t.categoryId == null;
  if (category) {
    const [type, rawId] = category.split(":");
    const id = Number(rawId);
    return type === "item" ? t.budgetItemId === id : t.categoryId === id && t.budgetItemId == null;
  }
  return true;
}

// useSearchParams needs a Suspense boundary on a statically rendered route.
export default function ProjectTransactionsPage({ params }: { params: Promise<{ projectId: string }> }) {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-40 w-full" /></div>}>
      <ProjectTransactionsContent params={params} />
    </Suspense>
  );
}

/**
 * A project's transactions for one breakdown row (a category or a month), in the
 * same layout as the budget category page.
 */
function ProjectTransactionsContent({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const id = parseInt(projectId, 10);
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const month = searchParams.get("month");

  const { formatAmount } = usePrivacy();
  const currency = useCurrency();
  const fmt = (n: number) => formatAmount(n, currency);

  const { project, error } = useProject(id);
  const allTransactions = useTransactions();
  const [movingId, setMovingId] = useState<number | null>(null);

  const transactions = useMemo(
    () =>
      allTransactions
        ?.filter((t) => t.projectId === id && matches(t, category, month))
        .sort(
          (a, b) =>
            b.date.getTime() - a.date.getTime() || (b.transactedAt?.getTime() ?? 0) - (a.transactedAt?.getTime() ?? 0)
        ),
    [allTransactions, id, category, month]
  );

  // What this page is showing, named from the project's own breakdown
  const slice = category ? project?.byCategory.find((c) => c.key === category) : undefined;
  const title = month
    ? (() => {
        const [y, m] = month.split("-").map(Number);
        return Number.isInteger(y) && m >= 0 && m <= 11 ? `${MONTH_NAMES[m]} ${y}` : "Transactions";
      })()
    : category === "uncategorized"
      ? "Uncategorized"
      : slice?.name ?? "Transactions";

  const total = transactions?.reduce((a, t) => a + (t.amountOut - t.amountIn), 0) ?? 0;

  /** Recategorize from the row; it leaves this list if it no longer matches. */
  const changeCategory = async (t: DbTransaction, value: PickerValue) => {
    if (!value || t.id == null) return;
    setMovingId(t.id);
    try {
      // Locked so keyword re-matching never moves it back
      await updateTransaction(t.id, { ...fromPickerValue(value), categoryLocked: true });
      toast.success("Transaction recategorized");
    } catch {
      toast.error("Failed to recategorize transaction");
    } finally {
      setMovingId(null);
    }
  };

  if (error) {
    return <p className="py-16 text-center text-sm text-muted-foreground">This project doesn&apos;t exist.</p>;
  }

  return (
    <div className="space-y-5 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/projects">Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/projects/${id}`}>{project?.name ?? "Project"}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            {project && <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />}
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {project?.name ?? "Project"}
            {slice?.groupName ? ` · ${slice.groupName}` : ""}
          </p>
        </div>
        <span className="text-xl font-semibold tabular-nums">{fmt(total)}</span>
      </div>

      <TransactionListCard
        transactions={transactions}
        emptyText="No transactions match."
        pickerPlaceholder="Category"
        movingId={movingId}
        onCategoryChange={changeCategory}
      />
    </div>
  );
}
