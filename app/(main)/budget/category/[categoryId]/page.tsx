"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { useBudgetHierarchy, updateTransaction } from "@/hooks";
import type { DbTransaction } from "@/lib/db/types";
import { fromPickerValue, type PickerValue } from "@/components/features/budget/budget-item-picker";
import { TransactionListCard } from "@/components/features/transactions/transaction-list-card";
import { useProjects } from "@/hooks/use-projects";
import { isSeparateProject } from "@/lib/budget/classify";
import { getTransactions } from "@/lib/db/client";
import { AddTransactionDialog } from "@/components/features/transactions/add-transaction-dialog";
import { CategoryDetailDialog } from "@/components/features/budget/category-detail-dialog";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function BudgetCategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = use(params);
  const id = parseInt(categoryId, 10);
  const searchParams = useSearchParams();
  const now = new Date();
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth()), 10);

  const { formatAmount } = usePrivacy();
  const currency = useCurrency();
  const fmt = (n: number) => formatAmount(n, currency);

  const hierarchy = useBudgetHierarchy(true);
  const category = hierarchy?.subcategories.find((c) => c.id === id);
  const group = hierarchy?.groups.find((g) => g.id === category?.groupId);

  const { start, end } = useMemo(
    () => ({ start: new Date(year, month, 1), end: new Date(year, month + 1, 0, 23, 59, 59) }),
    [year, month]
  );

  const { data: transactions } = useSWR(
    `budget-item-tx/${id}/${year}/${month}`,
    () => getTransactions({ budgetItemId: id, startDate: start, endDate: end }),
    { revalidateOnFocus: true }
  );

  // Separately funded project spend is not part of this month's budget total
  const projects = useProjects();
  const projectById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);
  const isProjectFunded = (projectId: number | null | undefined) =>
    projectId != null && isSeparateProject(projectById.get(projectId));
  const total =
    transactions?.reduce((a, t) => (isProjectFunded(t.projectId) ? a : a + (t.amountOut - t.amountIn)), 0) ?? 0;
  const projectTotal =
    transactions?.reduce((a, t) => (isProjectFunded(t.projectId) ? a + (t.amountOut - t.amountIn) : a), 0) ?? 0;
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [movingId, setMovingId] = useState<number | null>(null);

  /** Recategorize from the row; the row leaves this list once it no longer belongs here. */
  const moveTransaction = async (t: DbTransaction, value: PickerValue) => {
    if (!value || t.id == null || (value.kind === "item" && value.id === id)) return;
    setMovingId(t.id);
    try {
      // Locked so keyword re-matching never moves it back
      await updateTransaction(t.id, { ...fromPickerValue(value), categoryLocked: true });
      toast.success("Transaction moved");
    } catch {
      toast.error("Failed to move transaction");
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
          {group && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>{group.name}</BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{category?.name ?? "Category"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{category?.name ?? "Category"}</h1>
          <p className="text-sm text-muted-foreground">
            {MONTH_NAMES[month]} {year}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xl font-semibold tabular-nums">{fmt(total)}</span>
            {projectTotal !== 0 && (
              <p className="text-xs text-muted-foreground tabular-nums">+{fmt(projectTotal)} in projects</p>
            )}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)} disabled={!category}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
        </div>
      </div>

      <AddTransactionDialog open={addOpen} onOpenChange={setAddOpen} defaultBudgetItemId={id} />
      <CategoryDetailDialog
        category={
          category
            ? {
                id: category.id!,
                name: category.name,
                itemType: category.itemType,
                targetAmount: category.targetAmount ?? null,
                isActive: category.isActive,
                keywords: category.keywords ?? [],
                groupId: category.groupId,
              }
            : null
        }
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <TransactionListCard
        transactions={transactions}
        emptyText="No transactions this month."
        pickerPlaceholder={category?.name ?? "Category"}
        movingId={movingId}
        onCategoryChange={moveTransaction}
      />
    </div>
  );
}
