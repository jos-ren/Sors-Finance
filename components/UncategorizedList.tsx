"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Check, Pencil, X, Undo2, ChevronDown, ChevronRight } from "lucide-react";
import { Transaction } from "@/lib/types";
import { DbCategory } from "@/lib/db";
import { usePrivacy } from "@/lib/privacy-context";
import {
  TransactionTable,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
  formatCurrency,
  formatDate,
} from "@/components/resolve-step";

interface UncategorizedListProps {
  uncategorizedTransactions: Transaction[];
  categories: DbCategory[];
  onAddKeyword: (categoryId: string, keyword: string) => void;
  onCreateCategory: (name: string, keyword: string) => void;
  onExclude?: (transactionId: string) => void;
  onUndoExclude?: (transactionId: string) => void;
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
  onExclude,
  onUndoExclude,
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
    const isExcluded = excludedCategoryId && transactions.some(t => t.categoryId === excludedCategoryId);

    return {
      matchField,
      transactions,
      count: transactions.length,
      totalOut,
      totalIn,
      hasKeyword,
      addedKeyword,
      isExcluded,
      // Use the first transaction's date for sorting
      date: transactions[0].date,
    };
  }).sort((a, b) => b.date.getTime() - a.date.getTime());

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

  return (
    <>
      <TransactionTable>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Count</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactionGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.matchField);
            const canExpand = group.count > 1;

            return (
              <React.Fragment key={group.matchField}>
                <TableRow className={canExpand ? "cursor-pointer" : ""} onClick={canExpand ? () => toggleGroupExpanded(group.matchField) : undefined}>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {canExpand && (
                        isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )
                      )}
                      {formatDate(group.date)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm max-w-md truncate cursor-default">
                            {group.matchField}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <p>{group.matchField}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {group.count > 1 ? (
                      <Badge variant="secondary" className="text-xs">
                        {group.count}× transactions
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">1</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {group.totalOut > 0 ? (
                      <span className={isPrivacyMode ? "text-muted-foreground" : "text-destructive"}>
                        {formatAmount(group.totalOut, formatCurrency)}
                      </span>
                    ) : (
                      <span className={isPrivacyMode ? "text-muted-foreground" : "text-green-500"}>
                        {formatAmount(group.totalIn, formatCurrency)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {group.isExcluded ? (
                      <div className="flex items-center justify-end gap-2">
                        <Badge variant="secondary">
                          <X className="h-3 w-3 mr-1" />
                          Excluded
                        </Badge>
                        {onUndoExclude && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              group.transactions.forEach(t => onUndoExclude(t.id));
                            }}
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ) : group.hasKeyword ? (
                      <TooltipProvider>
                        <div className="flex items-center justify-end gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <div className="flex flex-col gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded max-w-[150px] truncate block cursor-default">
                                  {group.addedKeyword!.keyword}
                                </code>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{group.addedKeyword!.keyword}</p>
                              </TooltipContent>
                            </Tooltip>
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={group.addedKeyword!.categoryName}>
                              → {group.addedKeyword!.categoryName}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleGroupClick(group.transactions)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TooltipProvider>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGroupClick(group.transactions)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Keyword
                        </Button>
                        {onExclude && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              group.transactions.forEach(t => onExclude(t.id));
                            }}
                            title="Exclude from budget stats"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
                {/* Expanded sub-rows */}
                {isExpanded && group.transactions.map((transaction, idx) => (
                  <TableRow key={transaction.id} className="bg-muted/30">
                    <TableCell className="whitespace-nowrap pl-8 text-muted-foreground text-xs">
                      {formatDate(transaction.date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="max-w-md truncate cursor-default">
                              {transaction.description}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md">
                            <p>{transaction.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {idx + 1} of {group.count}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {transaction.amountOut > 0 ? (
                        <span className={isPrivacyMode ? "text-muted-foreground" : "text-destructive"}>
                          {formatAmount(transaction.amountOut, formatCurrency)}
                        </span>
                      ) : (
                        <span className={isPrivacyMode ? "text-muted-foreground" : "text-green-500"}>
                          {formatAmount(transaction.amountIn, formatCurrency)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            );
          })}
        </TableBody>
      </TransactionTable>

      {/* Keyword count summary */}
      {addedKeywords.size > 0 && (
        <p className="text-sm text-muted-foreground mt-3">
          {addedKeywords.size} keyword{addedKeywords.size !== 1 ? 's' : ''} added — will be applied on next reprocess
        </p>
      )}

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
  onExcludeAll: () => void;
  onReprocess: () => void;
  hasKeywordsToApply: boolean;
}

export function UncategorizedBulkActions({
  onExcludeAll,
  onReprocess,
  hasKeywordsToApply
}: UncategorizedBulkActionsProps) {
  return (
    <>
      {hasKeywordsToApply && (
        <Button size="sm" onClick={onReprocess}>
          Apply Keywords
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={onExcludeAll} title="Exclude all from budget stats">
        <X className="h-4 w-4 mr-1" />
        Exclude All
      </Button>
    </>
  );
}
