"use client";

import { use, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Check, Save, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { BankSourceBadge } from "@/components/features/layout/bank-source-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  useTransactions,
  useCategories,
  invalidateTransactions,
  invalidateBudgets,
  updateTransaction,
} from "@/hooks";
import { DbTransaction, SYSTEM_CATEGORIES } from "@/lib/db";
import { toast } from "sonner";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface RowEdit {
  description?: string;
  date?: string;
  amount?: string;
}


function AmountCell({
  value,
  isIncome,
  onChange,
  formatAmount,
  currency,
}: {
  value: string;
  isIncome: boolean;
  onChange: (v: string) => void;
  formatAmount: (amount: number, currency: string) => string;
  currency: string;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (editing) {
    return (
      <Input
        ref={inputRef}
        size="sm"
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        autoFocus
        className={cn(
          "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          isIncome ? "text-green-600" : ""
        )}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "w-full h-8 text-sm text-right px-3 rounded-4xl border border-input bg-input/30 transition-colors hover:bg-input/50 whitespace-nowrap overflow-hidden text-ellipsis",
        isIncome ? "text-green-600" : ""
      )}
    >
      {formatAmount(parseFloat(value) || 0, currency, false)}
    </button>
  );
}

type SortCol = "description" | "date" | "amount" | "category";
type SortDir = "asc" | "desc" | null;

function SortableHeader({
  label,
  col,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  col: SortCol;
  active: SortCol | null;
  dir: SortDir;
  onClick: (col: SortCol) => void;
  className?: string;
}) {
  const isActive = active === col;
  const Icon = isActive && dir === "asc" ? ArrowUp : isActive && dir === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      onClick={() => onClick(col)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium uppercase tracking-wide transition-colors",
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {label}
      <Icon className="h-3 w-3 shrink-0" />
    </button>
  );
}

function CategorySelect({
  tx,
  categories,
  onSwap,
}: {
  tx: DbTransaction;
  categories: ReturnType<typeof useCategories>;
  onSwap: (tx: DbTransaction, categoryId: number | null) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  const handleChange = async (val: string) => {
    setSaving(true);
    await onSwap(tx, val === "uncategorized" ? null : parseInt(val));
    setSaving(false);
  };

  return (
    <Select
      value={tx.categoryId?.toString() ?? "uncategorized"}
      onValueChange={handleChange}
      disabled={saving}
    >
      <SelectTrigger size="sm" className="w-full">
        <SelectValue placeholder="Uncategorized" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="uncategorized">Uncategorized</SelectItem>
        {categories
          ?.filter((c) => !c.isSystem)
          .map((c) => (
            <SelectItem key={c.id} value={c.id!.toString()}>
              {c.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

export default function CategoryTransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ viewMode?: string; year?: string; month?: string }>;
}) {
  const { categoryId: categoryIdStr } = use(params);
  const { viewMode: viewModeParam, year: yearParam, month: monthParam } = use(searchParams);

  const categoryId = parseInt(categoryIdStr);
  const viewMode = viewModeParam === "year" ? "year" : "month";
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
  const month = monthParam !== undefined ? parseInt(monthParam) : new Date().getMonth();

  const [pendingEdits, setPendingEdits] = useState<Map<number, RowEdit>>(new Map());
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  const { formatAmount } = usePrivacy();
  const userCurrency = useCurrency();
  const categories = useCategories();

  const category = categories?.find((c) => c.id === categoryId);

  const { startDate, endDate } = viewMode === "month"
    ? {
        startDate: new Date(year, month, 1),
        endDate: new Date(year, month + 1, 0, 23, 59, 59),
      }
    : {
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 11, 31, 23, 59, 59),
      };

  const transactions = useTransactions({ categoryId, startDate, endDate });

  const periodLabel = viewMode === "month"
    ? `${MONTH_NAMES[month]} ${year}`
    : `${year}`;

  const backHref = viewMode === "month"
    ? `/budget?viewMode=month&year=${year}&month=${month}`
    : `/budget?viewMode=year&year=${year}`;

  const totalSpent = transactions?.reduce((sum, tx) => sum + (tx.amountOut > 0 ? tx.amountOut : 0), 0) ?? 0;
  const totalIncome = transactions?.reduce((sum, tx) => sum + (tx.amountIn > 0 && tx.amountOut === 0 ? tx.amountIn : 0), 0) ?? 0;

  const sentinelRef = useSetPageHeader(category?.name ?? "Category Transactions");

  const updateEdit = useCallback((id: number, patch: Partial<RowEdit>) => {
    setPendingEdits((prev) => {
      const next = new Map(prev);
      next.set(id, { ...next.get(id), ...patch });
      return next;
    });
  }, []);

  const persistRow = useCallback(async (tx: DbTransaction) => {
    const edit = pendingEdits.get(tx.id!);
    if (!edit) return;

    const isIncome = tx.amountIn > 0 && tx.amountOut === 0;
    const description = edit.description ?? tx.description;
    const dateStr = edit.date ?? format(tx.date, "yyyy-MM-dd");
    const txDate = new Date(dateStr);
    txDate.setHours(12, 0, 0, 0);
    const rawAmount = edit.amount !== undefined ? parseFloat(edit.amount) : (isIncome ? tx.amountIn : tx.amountOut);
    const amountNum = isNaN(rawAmount) || rawAmount <= 0 ? (isIncome ? tx.amountIn : tx.amountOut) : rawAmount;

    await updateTransaction(tx.id!, {
      description,
      matchField: description,
      date: txDate,
      amountOut: isIncome ? 0 : amountNum,
      amountIn: isIncome ? amountNum : 0,
      netAmount: isIncome ? amountNum : -amountNum,
    });

    setPendingEdits((prev) => {
      const next = new Map(prev);
      next.delete(tx.id!);
      return next;
    });
  }, [pendingEdits]);

  const saveRow = useCallback(async (tx: DbTransaction) => {
    setSavingIds((prev) => new Set(prev).add(tx.id!));
    try {
      await persistRow(tx);
      invalidateTransactions();
      invalidateBudgets();
      toast.success("Transaction saved");
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(tx.id!);
        return next;
      });
    }
  }, [persistRow]);

  const saveAll = useCallback(async () => {
    if (!transactions) return;
    const dirty = transactions.filter((tx) => pendingEdits.has(tx.id!));
    const count = dirty.length;
    dirty.forEach((tx) => setSavingIds((prev) => new Set(prev).add(tx.id!)));
    try {
      await Promise.all(dirty.map(persistRow));
      invalidateTransactions();
      invalidateBudgets();
      toast.success(`${count} transaction${count !== 1 ? "s" : ""} saved`);
    } catch {
      toast.error("Some changes could not be saved");
    } finally {
      dirty.forEach((tx) => setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(tx.id!);
        return next;
      }));
    }
  }, [transactions, pendingEdits, persistRow]);

  const handleCategorySwap = useCallback(async (tx: DbTransaction, newCategoryId: number | null) => {
    try {
      await updateTransaction(tx.id!, { categoryId: newCategoryId });
      invalidateTransactions();
      invalidateBudgets();
      const catName = newCategoryId
        ? categories?.find((c) => c.id === newCategoryId)?.name ?? "category"
        : "Uncategorized";
      toast.success(`Moved to ${catName}`);
    } catch {
      toast.error("Failed to change category");
    }
  }, [categories]);

  const hasPendingEdits = pendingEdits.size > 0;

  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = useCallback((col: SortCol) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir("asc");
    } else {
      const next: SortDir = sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc";
      setSortDir(next);
      if (next === null) setSortCol(null);
    }
  }, [sortCol, sortDir]);

  const effectiveSortCol = sortDir === null ? null : sortCol;

  const sortedTransactions = useMemo(() => {
    if (!transactions || !effectiveSortCol || !sortDir) return transactions;
    return [...transactions].sort((a, b) => {
      let av: string | number, bv: string | number;
      if (effectiveSortCol === "description") { av = a.description.toLowerCase(); bv = b.description.toLowerCase(); }
      else if (effectiveSortCol === "date") { av = a.date.getTime(); bv = b.date.getTime(); }
      else if (effectiveSortCol === "amount") { av = a.amountOut || a.amountIn; bv = b.amountOut || b.amountIn; }
      else { av = (categories?.find(c => c.id === a.categoryId)?.name ?? "").toLowerCase(); bv = (categories?.find(c => c.id === b.categoryId)?.name ?? "").toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [transactions, effectiveSortCol, sortDir, categories]);

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/budget">Budget</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={backHref}>{periodLabel}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{category?.name ?? "..."}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{category?.name ?? "..."}</h1>
        <p className="text-muted-foreground">Transactions for {periodLabel}</p>
        <div ref={sentinelRef} className="h-0" />
      </div>

      {transactions && transactions.length > 0 && (
        <div className="flex gap-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Total spent: </span>
            <span className="font-semibold">{formatAmount(totalSpent, userCurrency)}</span>
          </div>
          {totalIncome > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground">Total income: </span>
              <span className="font-semibold text-green-600">{formatAmount(totalIncome, userCurrency)}</span>
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      <Card className="py-0">
        <CardContent className="p-0">
          {!transactions ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No transactions for this category in {periodLabel}.
            </div>
          ) : (
            <div>
              {/* Header */}
              <div className="grid grid-cols-[32px_minmax(0,1fr)_130px_120px_auto_32px] gap-3 px-6 py-4 border-b bg-muted/40">
                <span className="w-8 shrink-0" />
                <SortableHeader label="Title" col="description" active={effectiveSortCol} dir={sortDir} onClick={handleSort} />
                <SortableHeader label="Date" col="date" active={effectiveSortCol} dir={sortDir} onClick={handleSort} />
                <SortableHeader label="Amount" col="amount" active={effectiveSortCol} dir={sortDir} onClick={handleSort} className="justify-end" />
                <SortableHeader label="Category" col="category" active={effectiveSortCol} dir={sortDir} onClick={handleSort} />
                <span />
              </div>
              <div className="divide-y">
                {sortedTransactions?.map((tx) => {
                  const isIncome = tx.amountIn > 0 && tx.amountOut === 0;
                  const edit = pendingEdits.get(tx.id!);
                  const isDirty = !!edit;
                  const isSaving = savingIds.has(tx.id!);

                  const descValue = edit?.description ?? tx.description;
                  const dateValue = edit?.date ?? format(tx.date, "yyyy-MM-dd");
                  const rawAmount = isIncome ? tx.amountIn : tx.amountOut;
                  const amountValue = edit?.amount ?? rawAmount.toString();

                  return (
                    <div
                      key={tx.id}
                      className={cn(
                        "grid grid-cols-[32px_minmax(0,1fr)_130px_120px_auto_32px] gap-3 items-center px-6 py-2 transition-colors",
                        isDirty ? "bg-primary/5" : "hover:bg-muted/30"
                      )}
                    >
                      {/* Source */}
                      <BankSourceBadge
                        source={tx.source}
                        sourceMethod={tx.sourceMethod as "Plaid" | "CSV" | "Manual" | undefined}
                        sourceAccountName={tx.sourceAccountName ?? undefined}
                        size="sm"
                      />
                      {/* Title */}
                      <div className="min-w-0">
                        <Input
                          size="sm"
                          value={descValue}
                          onChange={(e) => updateEdit(tx.id!, { description: e.target.value })}
                          className="max-w-[250px]"
                        />
                      </div>
                      {/* Date */}
                      <DatePicker
                        size="sm"
                        value={new Date(dateValue + "T12:00:00")}
                        onChange={(d) => d && updateEdit(tx.id!, { date: format(d, "yyyy-MM-dd") })}
                      />
                      {/* Amount */}
                      <AmountCell
                        value={amountValue}
                        isIncome={isIncome}
                        onChange={(v) => updateEdit(tx.id!, { amount: v })}
                        formatAmount={formatAmount}
                        currency={userCurrency}
                      />
                      {/* Category */}
                      <CategorySelect
                        tx={tx}
                        categories={categories}
                        onSwap={handleCategorySwap}
                      />
                      {/* Per-row save */}
                      <div className="flex justify-center">
                        {isDirty && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="h-6 w-6 text-green-600 hover:text-green-700 bg-green-500/15 hover:bg-green-500/25"
                            onClick={() => saveRow(tx)}
                            disabled={isSaving}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FAB */}
      {hasPendingEdits && (
        <button
          onClick={saveAll}
          className="fixed bottom-8 right-8 z-50 flex items-center gap-2 rounded-full bg-green-600 px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-green-700 transition-colors"
        >
          <Save className="h-4 w-4" />
          Save all ({pendingEdits.size})
        </button>
      )}
    </div>
  );
}
