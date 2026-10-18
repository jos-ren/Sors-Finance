"use client";

import { Fragment, use, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Loader2 } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { useBudgetHierarchy, updateTransaction } from "@/hooks";
import type { DbTransaction } from "@/lib/db/types";
import {
  BudgetItemPicker,
  fromPickerValue,
  toPickerValue,
  type PickerValue,
} from "@/components/features/budget/budget-item-picker";
import { EditTransactionDialog } from "@/components/features/transactions/edit-transaction-dialog";
import {
  TransactionDetailLines,
  accountLabel,
  dayLabel,
  useAccountLookup,
} from "@/components/features/transactions/transaction-details";
import { BankSourceBadge } from "@/components/features/layout/bank-source-badge";
import { useProjects } from "@/hooks/use-projects";
import { isSeparateProject } from "@/lib/budget/classify";
import { ProjectChip } from "@/components/features/projects/project-chip";
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
  const [editingTransaction, setEditingTransaction] = useState<DbTransaction | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);
  const accountLookup = useAccountLookup();

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
            {MONTH_NAMES[month]} {year} · {transactions?.length ?? 0} transaction(s)
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
            <p className="p-8 text-center text-sm text-muted-foreground">No transactions this month.</p>
          ) : (
            <ul className="divide-y">
              {transactions.map((t, i) => {
                const net = t.amountOut - t.amountIn;
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
                      <div className="flex items-baseline gap-2">
                        <p className="truncate text-sm">{t.description}</p>
                        {t.projectId != null && projectById.has(t.projectId) && (
                          <ProjectChip
                            id={t.projectId}
                            name={projectById.get(t.projectId)!.name}
                            color={projectById.get(t.projectId)!.color}
                            className="py-0"
                          />
                        )}
                      </div>
                      <TransactionDetailLines transaction={t} lookup={accountLookup} />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={cn("text-sm tabular-nums", net < 0 && "text-primary")}>
                        {net < 0 ? `+${fmt(Math.abs(net))}` : fmt(net)}
                      </span>
                      {movingId === t.id ? (
                        <Loader2 className="mx-2 h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <BudgetItemPicker
                          variant="badge"
                          allowCreate
                          value={toPickerValue(t.categoryId, t.budgetItemId)}
                          onChange={(v) => moveTransaction(t, v)}
                          placeholder={category?.name ?? "Category"}
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
