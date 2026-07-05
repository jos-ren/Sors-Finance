"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Search, X, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2, StickyNote, Lock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditTransactionDialog } from "@/components/features/transactions/edit-transaction-dialog";
import { BankSourceBadge } from "@/components/features/layout/bank-source-badge";
import { normalizeBankName } from "@/lib/icons/bank-logos";
import { DbTransaction, DbCategory, SYSTEM_CATEGORIES } from "@/lib/db";
import { updateTransaction, invalidateTransactions } from "@/hooks";
import { useBudgetHierarchy } from "@/hooks/use-budget";
import { BudgetItemPicker, toPickerValue, fromPickerValue } from "@/components/features/budget/budget-item-picker";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency, useTimezone } from "@/contexts/settings-context";
import { formatDate } from "@/lib/utils/formatters";

interface TransactionDataTableProps {
  transactions: DbTransaction[];
  categories: DbCategory[];
  onDeleteTransaction?: (id: number) => void;
  onBulkDeleteTransactions?: (ids: number[]) => void;
}

export function TransactionDataTable({
  transactions,
  categories,
  onDeleteTransaction,
  onBulkDeleteTransactions,
}: TransactionDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  // Unified date filter: "all", "7days", "30days", "90days", "thisMonth", "lastMonth", "thisYear", "year:2024", "month:2024-0"
  const [dateFilter, setDateFilter] = useState<string>("all");

  // Edit state
  const [editingTransaction, setEditingTransaction] = useState<DbTransaction | null>(null);
  const [resettingId, setResettingId] = useState<number | null>(null);

  // Privacy mode and user currency
  const { formatAmount, isPrivacyMode } = usePrivacy();
  const userCurrency = useCurrency();
  const userTimezone = useTimezone();

  // Budget item names for resolving a transaction's assignment (item or system).
  const hierarchy = useBudgetHierarchy(true);
  const itemNames = useMemo(() => new Map((hierarchy?.items ?? []).map((i) => [i.id!, i.name])), [hierarchy]);

  const handleResetCategory = useCallback(async (id: number) => {
    setResettingId(id);
    try {
      await updateTransaction(id, { categoryLocked: false });
    } finally {
      setResettingId(null);
    }
  }, []);

  // Resolve a transaction's display name from its one-FK assignment.
  const getAssignmentName = useCallback(
    (t: Pick<DbTransaction, "categoryId" | "budgetItemId">): string => {
      if (t.budgetItemId != null) return itemNames.get(t.budgetItemId) ?? "Unknown";
      if (t.categoryId != null) return categories.find((c) => c.id === t.categoryId)?.name ?? "Unknown";
      return "Uncategorized";
    },
    [itemNames, categories]
  );

  const handleAssign = useCallback(
    async (id: number, value: ReturnType<typeof toPickerValue>) => {
      await updateTransaction(id, { ...fromPickerValue(value), categoryLocked: true });
      invalidateTransactions();
    },
    []
  );

  // Get available years and months from transactions
  const { availableYears, availableMonths } = useMemo(() => {
    const years = new Set<number>();
    const months = new Map<string, { year: number; month: number; label: string }>();

    transactions.forEach((t) => {
      const year = t.date.getFullYear();
      const month = t.date.getMonth();
      years.add(year);

      const key = `${year}-${month}`;
      if (!months.has(key)) {
        const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long" }).format(t.date);
        months.set(key, { year, month, label: `${monthLabel} ${year}` });
      }
    });

    return {
      availableYears: Array.from(years).sort((a, b) => b - a),
      availableMonths: Array.from(months.values()).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      }),
    };
  }, [transactions]);

  // Get available sources from transactions (normalized to canonical bank names)
  const availableSources = useMemo(() => {
    const sources = new Set<string>();
    transactions.forEach((t) => {
      if (t.source) {
        sources.add(normalizeBankName(t.source));
      }
    });
    return Array.from(sources).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  // Column definitions
  const columns: ColumnDef<DbTransaction>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "date",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => formatDate(row.getValue("date"), "display", userTimezone),
        sortingFn: (rowA, rowB) => {
          const dateA = rowA.original.date.getTime();
          const dateB = rowB.original.date.getTime();
          return dateA - dateB;
        },
      },
      {
        accessorKey: "description",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Description
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const note = row.original.note;
          return (
            <div className="flex items-center gap-1.5">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="max-w-[300px] truncate cursor-default">
                      {row.getValue("description")}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[400px] break-words">
                    {row.getValue("description")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {note && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <StickyNote className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-default" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[300px] break-words">
                      {note}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "netAmount",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Amount
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const transaction = row.original;
          if (transaction.amountOut > 0) {
            return (
              <span className={`font-medium ${isPrivacyMode ? "text-muted-foreground" : "text-destructive"}`}>
                {isPrivacyMode ? "" : "-"}{formatAmount(transaction.amountOut, userCurrency)}
              </span>
            );
          }
          return (
            <span className={`font-medium ${isPrivacyMode ? "text-muted-foreground" : "text-green-600"}`}>
              {isPrivacyMode ? "" : "+"}{formatAmount(transaction.amountIn, userCurrency)}
            </span>
          );
        },
      },
      {
        accessorKey: "budgetItemId",
        header: "Category",
        enableSorting: false,
        cell: ({ row }) => {
          const t = row.original;
          const uncategorized = t.budgetItemId == null && t.categoryId == null;
          const locked = t.categoryLocked;
          return (
            <div className="flex items-center gap-1.5">
              <BudgetItemPicker
                variant="badge"
                value={toPickerValue(t.categoryId, t.budgetItemId)}
                onChange={(v) => handleAssign(t.id!, v)}
                placeholder="Uncategorized"
                className={uncategorized ? "border-amber-500/50 text-amber-900 dark:text-amber-200" : ""}
              />
              {locked && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Lock className="h-3 w-3 text-muted-foreground shrink-0 cursor-default" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Manually set</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "source",
        header: "Source",
        enableSorting: false,
        cell: ({ row }) => (
          <BankSourceBadge
            source={row.getValue("source")}
            sourceMethod={row.original.sourceMethod as "Plaid" | "CSV" | "Manual" | undefined}
            sourceAccountName={row.original.sourceAccountName as string | undefined}
            size="sm"
          />
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingTransaction(row.original)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {row.original.categoryLocked && (
                <DropdownMenuItem
                  onClick={() => handleResetCategory(row.original.id!)}
                  disabled={resettingId === row.original.id}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to auto-category
                </DropdownMenuItem>
              )}
              {onDeleteTransaction && (
                <DropdownMenuItem
                  onClick={() => onDeleteTransaction(row.original.id!)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [handleAssign, formatAmount, handleResetCategory, isPrivacyMode, onDeleteTransaction, resettingId, userCurrency]
  );

  // Apply filters to transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Category filter — "uncategorized" | "item:<id>" | "sys:<id>"
    if (categoryFilter !== "all") {
      if (categoryFilter === "uncategorized") {
        filtered = filtered.filter((t) => t.budgetItemId == null && t.categoryId == null);
      } else if (categoryFilter.startsWith("item:")) {
        const itemId = parseInt(categoryFilter.slice(5), 10);
        filtered = filtered.filter((t) => t.budgetItemId === itemId);
      } else if (categoryFilter.startsWith("sys:")) {
        const catId = parseInt(categoryFilter.slice(4), 10);
        filtered = filtered.filter((t) => t.categoryId === catId);
      }
    }

    // Source filter (compare normalized names)
    if (sourceFilter !== "all") {
      filtered = filtered.filter((t) => t.source && normalizeBankName(t.source) === sourceFilter);
    }

    // Unified date filter
    if (dateFilter !== "all") {
      const now = new Date();

      if (dateFilter.startsWith("year:")) {
        // Year filter: "year:2024"
        const year = parseInt(dateFilter.replace("year:", ""));
        filtered = filtered.filter((t) => t.date.getFullYear() === year);
      } else if (dateFilter.startsWith("month:")) {
        // Month filter: "month:2024-0" (year-monthIndex)
        const [year, month] = dateFilter.replace("month:", "").split("-").map(Number);
        filtered = filtered.filter(
          (t) => t.date.getFullYear() === year && t.date.getMonth() === month
        );
      } else {
        // Quick date ranges
        let startDate: Date;
        let endDate: Date | null = null;

        switch (dateFilter) {
          case "7days":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "30days":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case "90days":
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          case "thisMonth":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case "lastMonth":
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
          case "thisYear":
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          default:
            startDate = new Date(0);
        }

        if (endDate) {
          filtered = filtered.filter((t) => t.date >= startDate && t.date <= endDate);
        } else {
          filtered = filtered.filter((t) => t.date >= startDate);
        }
      }
    }

    // Global search filter
    if (globalFilter) {
      const searchLower = globalFilter.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.description.toLowerCase().includes(searchLower) ||
          t.matchField.toLowerCase().includes(searchLower) ||
          getAssignmentName(t).toLowerCase().includes(searchLower) ||
          (t.note?.toLowerCase().includes(searchLower) ?? false)
      );
    }

    return filtered;
  }, [transactions, categoryFilter, sourceFilter, dateFilter, globalFilter, getAssignmentName]);

  const table = useReactTable({
    data: filteredTransactions,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    getRowId: (row) => row.id!.toString(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  // Get selected transaction IDs
  const selectedTransactionIds = useMemo(() => {
    return Object.keys(rowSelection)
      .filter((key) => rowSelection[key])
      .map((id) => parseInt(id));
  }, [rowSelection]);

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (onBulkDeleteTransactions && selectedTransactionIds.length > 0) {
      onBulkDeleteTransactions(selectedTransactionIds);
      setRowSelection({});
    }
    setShowBulkDeleteConfirm(false);
  };

  const hasActiveFilters =
    categoryFilter !== "all" ||
    sourceFilter !== "all" ||
    dateFilter !== "all" ||
    globalFilter !== "";

  const clearAllFilters = () => {
    setCategoryFilter("all");
    setSourceFilter("all");
    setDateFilter("all");
    setGlobalFilter("");
  };

  // Get the Ignore category ID
  const ignoreCategoryId = useMemo(() => {
    const ignoreCategory = categories.find(c => c.name === SYSTEM_CATEGORIES.EXCLUDED);
    return ignoreCategory?.id;
  }, [categories]);

  // Calculate totals for filtered transactions (excluding ignored)
  const totals = useMemo(() => {
    const nonIgnoredTransactions = filteredTransactions.filter(
      t => t.categoryId !== ignoreCategoryId
    );
    const income = nonIgnoredTransactions.reduce((sum, t) => sum + t.amountIn, 0);
    const expenses = nonIgnoredTransactions.reduce((sum, t) => sum + t.amountOut, 0);
    return { income, expenses, net: income - expenses };
  }, [filteredTransactions, ignoreCategoryId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>
              {filteredTransactions.length} of {transactions.length} transactions
            </CardDescription>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Income:</span>{" "}
              <span className={`font-medium ${isPrivacyMode ? "text-muted-foreground" : "text-green-600"}`}>{formatAmount(totals.income, userCurrency)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Expenses:</span>{" "}
              <span className={`font-medium ${isPrivacyMode ? "text-muted-foreground" : "text-destructive"}`}>{formatAmount(totals.expenses, userCurrency)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Net:</span>{" "}
              <span className={`font-medium ${isPrivacyMode ? "text-muted-foreground" : totals.net >= 0 ? "text-green-600" : "text-destructive"}`}>
                {formatAmount(totals.net, userCurrency)}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Unified Date Filter Select */}
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className={cn(
              "w-[160px]",
              dateFilter !== "all" && "border-primary"
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="overflow-y-auto">
              <SelectGroup>
                <SelectLabel>Quick Filters</SelectLabel>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="thisYear">This Year</SelectItem>
              </SelectGroup>
              {availableYears.length > 0 && (
                <SelectGroup>
                  <SelectLabel>By Year</SelectLabel>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={`year:${year}`}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {availableMonths.length > 0 && (
                <SelectGroup>
                  <SelectLabel>By Month</SelectLabel>
                  {availableMonths.map((m) => (
                    <SelectItem key={`${m.year}-${m.month}`} value={`month:${m.year}-${m.month}`}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className={cn(
              "w-[180px]",
              categoryFilter !== "all" && "border-primary"
            )}>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="uncategorized">Uncategorized</SelectItem>
              {(hierarchy?.items ?? [])
                .filter((i) => i.isActive)
                .map((i) => (
                  <SelectItem key={`item-${i.id}`} value={`item:${i.id}`}>
                    {i.name}
                  </SelectItem>
                ))}
              {categories
                .filter((cat) => cat.name === SYSTEM_CATEGORIES.INCOME || cat.name === SYSTEM_CATEGORIES.EXCLUDED)
                .map((cat) => (
                  <SelectItem key={`sys-${cat.id}`} value={`sys:${cat.id}`}>
                    {cat.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {/* Source Filter */}
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className={cn(
              "w-[160px]",
              sourceFilter !== "all" && "border-primary"
            )}>
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {availableSources.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear filters
            </Button>
          )}

          {/* Delete Selected */}
          {selectedTransactionIds.length > 0 && onBulkDeleteTransactions && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete ({selectedTransactionIds.length})
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No transactions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                filteredTransactions.length
              )}{" "}
              of {filteredTransactions.length} transactions
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page</span>
              <Select
                value={table.getState().pagination.pageSize.toString()}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount() || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Edit Transaction Dialog */}
      <EditTransactionDialog
        open={editingTransaction !== null}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
        transaction={editingTransaction}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transactions</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedTransactionIds.length} transaction{selectedTransactionIds.length !== 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleBulkDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
