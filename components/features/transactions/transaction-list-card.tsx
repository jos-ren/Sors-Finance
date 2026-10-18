"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BankSourceBadge } from "@/components/features/layout/bank-source-badge";
import { BudgetItemPicker, toPickerValue, type PickerValue } from "@/components/features/budget/budget-item-picker";
import { ProjectChip } from "@/components/features/projects/project-chip";
import { EditTransactionDialog } from "@/components/features/transactions/edit-transaction-dialog";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { useProjects } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";
import type { DbTransaction } from "@/lib/db/types";
import { TransactionDetailLines, accountLabel, dayLabel, useAccountLookup } from "./transaction-details";

/**
 * The month/category style transaction list: day headers, bank logo, merchant
 * with account, place and raw bank text, amount, a category picker and an edit
 * button. Shared by the budget category page, the uncategorized page, the
 * project transactions page and the project detail page so they read the same.
 */
export function TransactionListCard({
  title = "Transactions",
  transactions,
  emptyText,
  pickerPlaceholder,
  showCurrentCategory = true,
  movingId,
  onCategoryChange,
  embedded = false,
  hideProjectChip = false,
  rowAction,
}: {
  /** Card header, with the row count beside it. */
  title?: string;
  /** Undefined while loading. */
  transactions: DbTransaction[] | undefined;
  emptyText: string;
  pickerPlaceholder: string;
  /** Show each row's category in its picker. Off for lists of uncategorized rows (an empty picker to fill in). */
  showCurrentCategory?: boolean;
  /** Row currently being changed; shows a spinner in place of its picker. */
  movingId: number | null;
  onCategoryChange: (t: DbTransaction, value: PickerValue) => void;
  /** Render just the list, for a parent card that already has its own header. */
  embedded?: boolean;
  /** Every row belongs to the same project, so the chip says nothing. */
  hideProjectChip?: boolean;
  /** Extra button at the end of each row, after the edit pencil. */
  rowAction?: (t: DbTransaction) => ReactNode;
}) {
  const { formatAmount } = usePrivacy();
  const currency = useCurrency();
  const fmt = (n: number) => formatAmount(n, currency);
  const accountLookup = useAccountLookup();
  const projects = useProjects();
  const projectById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);
  const [editing, setEditing] = useState<DbTransaction | null>(null);

  const body = !transactions ? (
    <div className="space-y-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
    </div>
  ) : transactions.length === 0 ? (
    <p className="p-8 text-center text-sm text-muted-foreground">{emptyText}</p>
  ) : (
    <ul className="divide-y">
      {transactions.map((t, i) => {
        const net = t.amountOut - t.amountIn;
        const showDayHeader = i === 0 || dayLabel(transactions[i - 1].date) !== dayLabel(t.date);
        const project = !hideProjectChip && t.projectId != null ? projectById.get(t.projectId) : undefined;
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
                  {project && (
                    <ProjectChip id={project.id} name={project.name} color={project.color} className="py-0" compact />
                  )}
                </div>
                <TransactionDetailLines transaction={t} lookup={accountLookup} showSuggestion={false} />
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
                    value={showCurrentCategory ? toPickerValue(t.categoryId, t.budgetItemId) : null}
                    onChange={(v) => onCategoryChange(t, v)}
                    placeholder={pickerPlaceholder}
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => setEditing(t)}
                  aria-label={`Edit ${t.description}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {rowAction?.(t)}
              </div>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );

  return (
    <>
      <EditTransactionDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        transaction={editing}
      />

      {embedded ? (
        <div className="border-t">{body}</div>
      ) : (
        // No card padding: the header and list (with its day headers) run edge to edge
        <Card className="gap-0 py-0">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <h2 className="text-sm font-semibold">{title}</h2>
            {transactions && (
              <Badge variant="secondary" className="tabular-nums">
                {transactions.length}
              </Badge>
            )}
          </div>
          <CardContent className="p-0">{body}</CardContent>
        </Card>
      )}
    </>
  );
}
