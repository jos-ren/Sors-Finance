"use client";

import { useState, useMemo } from "react";
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
import { ArrowUpDown, Search, X, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2, CalendarDays, Check } from "lucide-react";
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
  SelectItem,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
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
import { EditTransactionDialog } from "@/components/EditTransactionDialog";
import { BankSourceBadge } from "@/components/BankSourceBadge";
import { DbTransaction, DbCategory, SYSTEM_CATEGORIES } from "@/lib/db";
import { usePrivacy } from "@/lib/privacy-context";
import { useCurrency } from "@/lib/settings-context";

interface TransactionDataTableProps {
  transactions: DbTransaction[];
  categories: DbCategory[];
  onDeleteTransaction?: (id: number) => void;
  onBulkDeleteTransactions?: (ids: number[]) => void;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
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
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  // Edit state
  const [editingTransaction, setEditingTransaction] = useState<DbTransaction | null>(null);

  // Privacy mode and user currency
  const { formatAmount, isPrivacyMode } = usePrivacy();
  const userCurrency = useCurrency();

  // Get category name by ID
  const getCategoryName = (categoryId: number | null): string => {
    if (categoryId === null) return "Uncategorized";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "Unknown";
  };

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
        cell: ({ row }) => formatDate(row.getValue("date")),
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
        cell: ({ row }) => (
          <div className="max-w-[300px] truncate" title={row.getValue("description")}>
            {row.getValue("description")}
          </div>
        ),
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
        accessorKey: "categoryId",
        header: "Category",
        enableSorting: false,
        cell: ({ row }) => {
          const categoryId = row.getValue("categoryId") as number | null;
          const categoryName = getCategoryName(categoryId);
          return (
            <Badge
              variant="secondary"
              className={categoryId === null ? "text-amber-900 dark:text-amber-200" : ""}
              style={categoryId === null ? { backgroundColor: "oklch(0.77 0.16 70 / 0.4)" } : undefined}
            >
              {categoryName}
            </Badge>
          );
        },
      },
      {
        accessorKey: "source",
        header: "Source",
        enableSorting: false,
        cell: ({ row }) => (
          <BankSourceBadge source={row.getValue("source")} size="sm" />
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
    [categories, formatAmount, isPrivacyMode, onDeleteTransaction, userCurrency]
  );

  // Apply filters to transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Category filter
    if (categoryFilter !== "all") {
      if (categoryFilter === "uncategorized") {
        filtered = filtered.filter((t) => t.categoryId === null);
      } else {
        const catId = parseInt(categoryFilter);
        filtered = filtered.filter((t) => t.categoryId === catId);
      }
    }

    // Source filter
    if (sourceFilter !== "all") {
      filtered = filtered.filter((t) => t.source === sourceFilter);
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
          getCategoryName(t.categoryId).toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [transactions, categoryFilter, sourceFilter, dateFilter, globalFilter, categories]);

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

  // Get human-readable label for current date filter
  const getDateFilterLabel = () => {
    if (dateFilter === "all") return "All Time";
    if (dateFilter === "7days") return "Last 7 Days";
    if (dateFilter === "30days") return "Last 30 Days";
    if (dateFilter === "90days") return "Last 90 Days";
    if (dateFilter === "thisMonth") return "This Month";
    if (dateFilter === "lastMonth") return "Last Month";
    if (dateFilter === "thisYear") return "This Year";
    if (dateFilter.startsWith("year:")) {
      return dateFilter.replace("year:", "");
    }
    if (dateFilter.startsWith("month:")) {
      const [year, month] = dateFilter.replace("month:", "").split("-").map(Number);
      const date = new Date(year, month, 1);
      return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
    }
    return "Custom";
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

          {/* Unified Date Filter Popover */}
          <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[160px] justify-start text-left font-normal",
                  dateFilter !== "all" && "border-primary"
                )}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {getDateFilterLabel()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] px-0 py-[10px] gap-0 max-h-[400px] overflow-y-auto" align="start">
              <p className="text-xs text-muted-foreground px-2 mb-[6px]">Quick Filters</p>
              <div className="flex flex-col">
                {[
                  { value: "all", label: "All Time" },
                  { value: "7days", label: "Last 7 Days" },
                  { value: "30days", label: "Last 30 Days" },
                  { value: "90days", label: "Last 90 Days" },
                  { value: "thisMonth", label: "This Month" },
                  { value: "lastMonth", label: "Last Month" },
                  { value: "thisYear", label: "This Year" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => { setDateFilter(option.value); setDatePopoverOpen(false); }}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-accent text-left",
                      dateFilter === option.value && "bg-accent"
                    )}
                  >
                    {option.label}
                    {dateFilter === option.value && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
              {availableYears.length > 0 && (
                <>
                  <Separator className="my-[10px]" />
                  <p className="text-xs text-muted-foreground px-2 mb-[6px]">By Year</p>
                  <div className="flex flex-wrap gap-1 px-2">
                    {availableYears.map((year) => (
                      <button
                        key={year}
                        onClick={() => { setDateFilter(`year:${year}`); setDatePopoverOpen(false); }}
                        className={cn(
                          "px-2 py-1 text-sm rounded hover:bg-accent",
                          dateFilter === `year:${year}` && "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {availableMonths.length > 0 && (
                <>
                  <Separator className="my-[10px]" />
                  <p className="text-xs text-muted-foreground px-2 mb-[6px]">By Month</p>
                  <div className="flex flex-col">
                    {availableMonths.map((m) => (
                      <button
                        key={`${m.year}-${m.month}`}
                        onClick={() => { setDateFilter(`month:${m.year}-${m.month}`); setDatePopoverOpen(false); }}
                        className={cn(
                          "w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-accent text-left",
                          dateFilter === `month:${m.year}-${m.month}` && "bg-accent"
                        )}
                      >
                        {m.label}
                        {dateFilter === `month:${m.year}-${m.month}` && <Check className="h-3.5 w-3.5" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </PopoverContent>
          </Popover>

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
              {categories
                .filter((cat) => cat.name !== SYSTEM_CATEGORIES.UNCATEGORIZED)
                .map((cat) => (
                  <SelectItem key={cat.id} value={cat.id!.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {/* Source Filter */}
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className={cn(
              "w-[140px]",
              sourceFilter !== "all" && "border-primary"
            )}>
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="CIBC">CIBC</SelectItem>
              <SelectItem value="AMEX">AMEX</SelectItem>
              <SelectItem value="Manual">Manual</SelectItem>
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
        categories={categories}
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
