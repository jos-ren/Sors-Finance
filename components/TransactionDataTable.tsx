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
import { ArrowUpDown, Search, X, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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

interface TransactionDataTableProps {
  transactions: DbTransaction[];
  categories: DbCategory[];
  onDeleteTransaction?: (id: number) => void;
  onBulkDeleteTransactions?: (ids: number[]) => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
  const [showBulkCategoryDialog, setShowBulkCategoryDialog] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string | null>(null);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");

  // Edit state
  const [editingTransaction, setEditingTransaction] = useState<DbTransaction | null>(null);

  // Privacy mode
  const { formatAmount, isPrivacyMode } = usePrivacy();

  // Get category name by ID
  const getCategoryName = (categoryId: number | null): string => {
    if (categoryId === null) return "Uncategorized";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "Unknown";
  };

  // Get unique sources from transactions (for dynamic filter)
  const uniqueSources = useMemo(() => {
    const sources = new Set(transactions.map((t) => t.source));
    return Array.from(sources).sort();
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
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
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
                {isPrivacyMode ? "" : "-"}{formatAmount(transaction.amountOut, formatCurrency)}
              </span>
            );
          }
          return (
            <span className={`font-medium ${isPrivacyMode ? "text-muted-foreground" : "text-green-600"}`}>
              {isPrivacyMode ? "" : "+"}{formatAmount(transaction.amountIn, formatCurrency)}
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
          <div onClick={(e) => e.stopPropagation()}>
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
          </div>
        ),
      },
    ],
    [categories, formatAmount, isPrivacyMode, onDeleteTransaction]
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

    // Date range filter
    if (dateRangeFilter !== "all") {
      const now = new Date();
      let startDate: Date;

      switch (dateRangeFilter) {
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
          const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
          filtered = filtered.filter(
            (t) => t.date >= startDate && t.date <= endOfLastMonth
          );
          break;
        case "thisYear":
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(0);
      }

      if (dateRangeFilter !== "lastMonth") {
        filtered = filtered.filter((t) => t.date >= startDate);
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
  }, [transactions, categoryFilter, sourceFilter, dateRangeFilter, globalFilter, categories]);

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

  // Handle bulk category change
  const handleBulkCategoryChange = async () => {
    if (selectedTransactionIds.length === 0 || bulkCategoryId === null) {
      return;
    }

    try {
      const categoryIdNum = bulkCategoryId === "null" ? null : parseInt(bulkCategoryId);

      const response = await fetch("/api/transactions/bulk-category", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedTransactionIds,
          categoryId: categoryIdNum,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update categories");
      }

      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      console.error("Error updating categories:", error);
      alert("Failed to update transaction categories");
    } finally {
      setShowBulkCategoryDialog(false);
      setBulkCategoryId(null);
      setRowSelection({});
    }
  };

  const hasActiveFilters =
    categoryFilter !== "all" ||
    sourceFilter !== "all" ||
    dateRangeFilter !== "all" ||
    globalFilter !== "";

  const clearAllFilters = () => {
    setCategoryFilter("all");
    setSourceFilter("all");
    setDateRangeFilter("all");
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
              <span className={`font-medium ${isPrivacyMode ? "text-muted-foreground" : "text-green-600"}`}>{formatAmount(totals.income, formatCurrency)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Expenses:</span>{" "}
              <span className={`font-medium ${isPrivacyMode ? "text-muted-foreground" : "text-destructive"}`}>{formatAmount(totals.expenses, formatCurrency)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Net:</span>{" "}
              <span className={`font-medium ${isPrivacyMode ? "text-muted-foreground" : totals.net >= 0 ? "text-green-600" : "text-destructive"}`}>
                {formatAmount(totals.net, formatCurrency)}
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

          {/* Date Range Filter */}
          <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="thisYear">This Year</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
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
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {uniqueSources.map((source) => (
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

          {/* Bulk Category Change */}
          {selectedTransactionIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkCategoryDialog(true)}
            >
              Change Category ({selectedTransactionIds.length})
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
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={() => row.toggleSelected()}
                    className="cursor-pointer"
                  >
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

      {/* Bulk Category Change Dialog */}
      <AlertDialog open={showBulkCategoryDialog} onOpenChange={setShowBulkCategoryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Category</AlertDialogTitle>
            <AlertDialogDescription>
              Select a category to apply to {selectedTransactionIds.length} selected transaction{selectedTransactionIds.length !== 1 ? 's' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={bulkCategoryId || undefined} onValueChange={setBulkCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Uncategorized</SelectItem>
                {categories
                  .filter((cat) => cat.name !== SYSTEM_CATEGORIES.UNCATEGORIZED)
                  .map((cat) => (
                    <SelectItem key={cat.id} value={cat.id!.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkCategoryId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkCategoryChange}
              disabled={!bulkCategoryId}
            >
              Update Category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
