"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useVirtualScroll } from "@/components/resolve-step/VirtualScrollContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { Transaction } from "@/lib/types";
import { DbCategory } from "@/lib/db";
import { usePrivacy } from "@/lib/privacy-context";
import { useCurrency } from "@/lib/settings-context";
import { formatDate } from "@/components/resolve-step";

const ROW_HEIGHT = 41;
const SUBROW_HEIGHT = 33;

type GroupItem = {
  matchField: string;
  transactions: Transaction[];
  count: number;
  totalOut: number;
  totalIn: number;
  hasKeyword: boolean;
  addedKeyword: { keyword: string; categoryId: string; categoryName: string } | null | undefined;
  isExcluded: boolean | undefined;
  isCategorized: boolean;
  assignedCategory: import("@/lib/db").DbCategory | null | undefined;
  date: Date;
};

type FlatRow =
  | { type: "group"; group: GroupItem; isExpanded: boolean; canExpand: boolean }
  | { type: "subrow"; transaction: Transaction; idx: number; total: number };

interface UncategorizedListProps {
  uncategorizedTransactions: Transaction[];
  categories: DbCategory[];
  onAddKeyword: (categoryId: string, keyword: string) => void;
  onCreateCategory: (name: string, keyword: string) => void;
  onChangeCategory?: (transactionIds: string[], categoryId: string) => void;
  excludedCategoryId?: string; // UUID of the Excluded category
}

interface AddedKeyword {
  keyword: string;
  categoryId: string;
  categoryName: string;
}

export function UncategorizedList({
  uncategorizedTransactions,
  categories,
  onAddKeyword,
  onCreateCategory,
  onChangeCategory,
  excludedCategoryId,
}: UncategorizedListProps) {
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [keyword, setKeyword] = useState("");
  const [categoryValue, setCategoryValue] = useState("");
  const [keywordError, setKeywordError] = useState("");
  const [addedKeywords, setAddedKeywords] = useState<Map<string, AddedKeyword>>(new Map());
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const { formatAmount, isPrivacyMode } = usePrivacy();
  const userCurrency = useCurrency();

  const toggleGroupExpanded = (matchField: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(matchField)) {
        next.delete(matchField);
      } else {
        next.add(matchField);
      }
      return next;
    });
  };

  // Filter out "Uncategorized" category - it should only contain unmatched transactions
  const selectableCategories = categories.filter(
    (cat) => cat.name.toLowerCase() !== "uncategorized"
  );

  // Find if the typed value matches an existing category (exact match)
  const matchedCategory = selectableCategories.find(
    (cat) => cat.name.toLowerCase() === categoryValue.toLowerCase()
  );
  const isCreatingNew = categoryValue.trim() !== "" && !matchedCategory;

  // Filter categories based on typed value
  const filteredCategories = selectableCategories.filter((cat) =>
    cat.name.toLowerCase().includes(categoryValue.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node) &&
        categoryInputRef.current &&
        !categoryInputRef.current.contains(event.target as Node)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpenDialog = (transaction: Transaction, isEditing: boolean = false) => {
    setSelectedTransaction(transaction);

    // If editing, pre-fill the form with existing data
    if (isEditing && addedKeywords.has(transaction.id)) {
      const added = addedKeywords.get(transaction.id)!;
      setKeyword(added.keyword);
      setCategoryValue(added.categoryName);
    } else {
      // Autofill keyword with description
      setKeyword(transaction.description);
      setCategoryValue("");
    }

    setKeywordError("");
  };

  const handleCloseDialog = () => {
    setSelectedTransaction(null);
    setKeyword("");
    setCategoryValue("");
    setKeywordError("");
    setIsCategoryDropdownOpen(false);
  };

  const handleSelectCategory = (categoryName: string) => {
    setCategoryValue(categoryName);
    setIsCategoryDropdownOpen(false);
  };

  const handleKeywordChange = (value: string) => {
    setKeyword(value);
    setKeywordError("");
  };

  const checkKeywordExists = (keyword: string): { exists: boolean; categoryName?: string; categoryId?: string } => {
    const keywordLower = keyword.toLowerCase();

    for (const category of categories) {
      if (category.keywords.some(k => k.toLowerCase() === keywordLower)) {
        return { exists: true, categoryName: category.name, categoryId: category.uuid };
      }
    }

    return { exists: false };
  };

  // Group transactions by matchField
  const groupedTransactions = uncategorizedTransactions.reduce((acc, transaction) => {
    const key = transaction.matchField;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(transaction);
    return acc;
  }, {} as Record<string, Transaction[]>);

  // Convert to array and calculate totals
  const transactionGroups = Object.entries(groupedTransactions).map(([matchField, transactions]) => {
    const totalOut = transactions.reduce((sum, t) => sum + t.amountOut, 0);
    const totalIn = transactions.reduce((sum, t) => sum + t.amountIn, 0);
    const hasKeyword = transactions.some(t => addedKeywords.has(t.id));
    const addedKeyword = hasKeyword ? addedKeywords.get(transactions[0].id) : null;
    const isExcluded = !!excludedCategoryId && transactions.some(t => t.categoryId === excludedCategoryId);

    // Check if transaction has been categorized (has categoryId that's not excluded)
    const firstTransaction = transactions[0];
    const isCategorized = !!firstTransaction.categoryId && firstTransaction.categoryId !== excludedCategoryId;
    const assignedCategory = isCategorized
      ? categories.find(c => c.uuid === firstTransaction.categoryId)
      : null;

    return {
      matchField,
      transactions,
      count: transactions.length,
      totalOut,
      totalIn,
      hasKeyword,
      addedKeyword,
      isExcluded,
      isCategorized,
      assignedCategory,
      // Use the first transaction's date for sorting
      date: transactions[0].date,
    };
  }).sort((a, b) => b.date.getTime() - a.date.getTime());

  // Flatten groups + expanded sub-rows into a single array for the virtualizer
  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    for (const group of transactionGroups) {
      const isExpanded = expandedGroups.has(group.matchField);
      const canExpand = group.count > 1;
      rows.push({ type: "group", group, isExpanded, canExpand });
      if (isExpanded && canExpand) {
        group.transactions.forEach((t, idx) => {
          rows.push({ type: "subrow", transaction: t, idx, total: group.count });
        });
      }
    }
    return rows;
  }, [transactionGroups, expandedGroups]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const outerScrollRef = useVirtualScroll();

  useLayoutEffect(() => {
    const container = containerRef.current;
    const outerScroll = outerScrollRef?.current;
    if (!container || !outerScroll) return;
    const outerRect = outerScroll.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setScrollMargin(Math.max(0, containerRect.top - outerRect.top + outerScroll.scrollTop));
  });

  // Re-measure when the scroll container resizes (e.g. tab animation completes on first open)
  useEffect(() => {
    const outerScroll = outerScrollRef?.current;
    const container = containerRef.current;
    if (!outerScroll || !container) return;
    const observer = new ResizeObserver(() => {
      const outerRect = outerScroll.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setScrollMargin(Math.max(0, containerRect.top - outerRect.top + outerScroll.scrollTop));
    });
    observer.observe(outerScroll);
    return () => observer.disconnect();
  }, [outerScrollRef]);

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => outerScrollRef?.current ?? null,
    estimateSize: (i) => (flatRows[i]?.type === "subrow" ? SUBROW_HEIGHT : ROW_HEIGHT),
    overscan: 5,
    scrollMargin,
    getItemKey: (i) => {
      const row = flatRows[i];
      if (!row) return i;
      return row.type === "group" ? `g:${row.group.matchField}` : `s:${row.transaction.id}`;
    },
  });

  const handleGroupClick = (transactions: Transaction[]) => {
    // Open dialog with the first transaction (they all have same matchField)
    handleOpenDialog(transactions[0], addedKeywords.has(transactions[0].id));
  };

  const handleSubmit = () => {
    const trimmedKeyword = keyword.trim();
    const trimmedCategory = categoryValue.trim();

    if (!trimmedKeyword) {
      setKeywordError("Please enter a keyword");
      return;
    }

    if (!trimmedCategory) {
      setKeywordError("Please select or enter a category");
      return;
    }

    // Validate that keyword exists in description
    if (selectedTransaction) {
      const descriptionLower = selectedTransaction.description.toLowerCase();
      const keywordLower = trimmedKeyword.toLowerCase();

      if (!descriptionLower.includes(keywordLower)) {
        setKeywordError(`"${trimmedKeyword}" not found in the description. Please enter a keyword that appears in the text above.`);
        return;
      }
    }

    // Check if keyword already exists in another category
    const existsCheck = checkKeywordExists(trimmedKeyword);
    if (existsCheck.exists) {
      // If adding to the same category, that's fine
      if (matchedCategory && matchedCategory.uuid === existsCheck.categoryId) {
        // Same category, this is fine
      } else {
        setKeywordError(`"${trimmedKeyword}" already exists in the "${existsCheck.categoryName}" category. Each keyword can only exist in one category to avoid conflicts.`);
        return;
      }
    }

    if (isCreatingNew) {
      // Creating new category
      onCreateCategory(trimmedCategory, trimmedKeyword);
    } else if (matchedCategory) {
      // Adding to existing category
      onAddKeyword(matchedCategory.uuid, trimmedKeyword);
    }

    // Apply to all transactions with the same matchField
    if (selectedTransaction) {
      const newMap = new Map(addedKeywords);

      // Find all transactions with the same matchField
      const matchingTransactions = uncategorizedTransactions.filter(
        t => t.matchField === selectedTransaction.matchField
      );

      // Add keyword tracking for all matching transactions
      matchingTransactions.forEach(t => {
        newMap.set(t.id, {
          keyword: trimmedKeyword,
          categoryId: matchedCategory?.uuid || "new",
          categoryName: trimmedCategory,
        });
      });

      setAddedKeywords(newMap);
    }

    handleCloseDialog();
  };

  if (uncategorizedTransactions.length === 0) {
    return null;
  }

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start - scrollMargin : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end + scrollMargin
      : 0;

  return (
    <>
      <div ref={containerRef}>
        <table className="w-full caption-bottom text-sm" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 100 }} />
            <col />
            <col style={{ width: 100 }} />
            <col style={{ width: 200 }} />
          </colgroup>
          <thead className="border-b">
            <tr>
              <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground pl-6">Date</th>
              <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Description</th>
              <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Amount</th>
              <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground pr-6">Status</th>
            </tr>
          </thead>
          <tbody>
            {paddingTop > 0 && <tr><td colSpan={4} style={{ height: paddingTop }} /></tr>}
            {virtualItems.map((vItem) => {
              const row = flatRows[vItem.index];
              if (!row) return null;

              if (row.type === "group") {
                const { group, isExpanded, canExpand } = row;
                return (
                  <tr
                    key={vItem.key}
                    className={`border-b transition-colors hover:bg-muted/50 ${canExpand ? "cursor-pointer" : ""}`}
                    onClick={canExpand ? () => toggleGroupExpanded(group.matchField) : undefined}
                  >
                    <td className="p-2 whitespace-nowrap pl-6">
                      <div className="flex items-center gap-1">
                        {canExpand && (
                          isExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        {formatDate(group.date)}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-sm truncate cursor-default">{group.matchField}</p>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md"><p>{group.matchField}</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {group.count > 1 && (
                          <Badge variant="secondary" className="text-xs shrink-0">×{group.count}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {group.totalOut > 0 ? (
                        <span className={isPrivacyMode ? "text-muted-foreground" : "text-destructive"}>
                          {formatAmount(group.totalOut, userCurrency)}
                        </span>
                      ) : (
                        <span className={isPrivacyMode ? "text-muted-foreground" : "text-green-500"}>
                          {formatAmount(group.totalIn, userCurrency)}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        {group.isExcluded || group.isCategorized ? (
                          <Select
                            value={group.isExcluded ? excludedCategoryId : group.assignedCategory?.uuid}
                            onValueChange={(value) => onChangeCategory?.(group.transactions.map(t => t.id), value)}
                          >
                            <SelectTrigger className="w-[140px] h-7 text-xs">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectableCategories.map((cat) => (
                                <SelectItem key={cat.uuid} value={cat.uuid} className="text-xs">{cat.name}</SelectItem>
                              ))}
                              {excludedCategoryId && (
                                <SelectItem value={excludedCategoryId} className="text-xs">Excluded</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-[140px] h-7 text-xs"
                            onClick={() => handleGroupClick(group.transactions)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Keyword
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }

              // Sub-row
              const { transaction, idx, total } = row;
              return (
                <tr key={vItem.key} className="bg-muted/30 border-b">
                  <td className="p-2 whitespace-nowrap pl-14 text-muted-foreground text-xs">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="p-2 text-muted-foreground text-xs">
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="truncate cursor-default">{transaction.description}</p>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md"><p>{transaction.description}</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <span className="text-muted-foreground/60 shrink-0">({idx + 1}/{total})</span>
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap text-xs">
                    {transaction.amountOut > 0 ? (
                      <span className={isPrivacyMode ? "text-muted-foreground" : "text-destructive"}>
                        {formatAmount(transaction.amountOut, userCurrency)}
                      </span>
                    ) : (
                      <span className={isPrivacyMode ? "text-muted-foreground" : "text-green-500"}>
                        {formatAmount(transaction.amountIn, userCurrency)}
                      </span>
                    )}
                  </td>
                  <td />
                </tr>
              );
            })}
            {paddingBottom > 0 && <tr><td colSpan={4} style={{ height: paddingBottom }} /></tr>}
          </tbody>
        </table>
      </div>


      {/* Add Keyword Dialog */}
      <Dialog open={selectedTransaction !== null} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Keyword to Category</DialogTitle>
            <DialogDescription>
              Extract a keyword from the transaction description to automatically
              categorize similar transactions.
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-6">
              {/* Description */}
              <div className="space-y-2">
                <Label>Description</Label>
                <code className="text-sm bg-muted px-3 py-2 rounded block break-all font-mono">
                  {selectedTransaction.description}
                </code>
              </div>

              {/* Keyword Input */}
              <div className="space-y-2">
                <Label htmlFor="keyword-input">Keyword</Label>
                <Input
                  id="keyword-input"
                  value={keyword}
                  onChange={(e) => handleKeywordChange(e.target.value)}
                  placeholder="e.g., NINTEND, STARBUCKS, etc."
                  className={keywordError ? "border-destructive" : ""}
                />
                {keywordError ? (
                  <p className="text-xs text-destructive mt-1">
                    {keywordError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Choose a unique part of the description to match similar transactions.
                  </p>
                )}
              </div>

              {/* Category Selection */}
              <div className="space-y-2">
                <Label>Category</Label>
                <div className="relative">
                  <Input
                    ref={categoryInputRef}
                    value={categoryValue}
                    onChange={(e) => {
                      setCategoryValue(e.target.value);
                      setIsCategoryDropdownOpen(true);
                    }}
                    onFocus={() => setIsCategoryDropdownOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setIsCategoryDropdownOpen(false);
                        e.preventDefault();
                      } else if (e.key === "Enter" && filteredCategories.length === 1) {
                        // Auto-select if only one match
                        handleSelectCategory(filteredCategories[0].name);
                        e.preventDefault();
                      }
                    }}
                    placeholder="Select or type a new category..."
                    autoComplete="off"
                  />
                  {isCategoryDropdownOpen && (
                    <div
                      ref={categoryDropdownRef}
                      className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto"
                    >
                      {filteredCategories.length > 0 ? (
                        filteredCategories.map((cat) => {
                          const isSelected = cat.name.toLowerCase() === categoryValue.toLowerCase();
                          return (
                            <button
                              key={cat.uuid}
                              type="button"
                              className={`w-full px-3 py-2 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                                isSelected
                                  ? "bg-accent text-accent-foreground"
                                  : "hover:bg-accent hover:text-accent-foreground"
                              }`}
                              onClick={() => handleSelectCategory(cat.name)}
                            >
                              {cat.name}
                            </button>
                          );
                        })
                      ) : categoryValue.trim() ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Press Add Keyword to create &quot;{categoryValue.trim()}&quot;
                        </div>
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No categories found. Type to create a new one.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {isCreatingNew && categoryValue.trim() && (
                  <p className="text-xs text-muted-foreground">
                    This will create a new category: &quot;{categoryValue.trim()}&quot;
                  </p>
                )}
                {matchedCategory && (
                  <p className="text-xs text-muted-foreground">
                    Adding to existing category: &quot;{matchedCategory.name}&quot;
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!keyword.trim() || !categoryValue.trim()}
            >
              Add Keyword
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Bulk action buttons component for use in ResolveSection
interface UncategorizedBulkActionsProps {
  onReprocess: () => void;
}

export function UncategorizedBulkActions({ onReprocess }: UncategorizedBulkActionsProps) {
  return (
    <Button size="sm" variant="outline" onClick={onReprocess}>
      <RotateCcw className="h-3 w-3 mr-1" />
      Re-process
    </Button>
  );
}
