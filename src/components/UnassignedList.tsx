"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, Check, Pencil } from "lucide-react";
import { Transaction, Category } from "@/lib/types";

interface UnassignedListProps {
  unassignedTransactions: Transaction[];
  categories: Category[];
  onAddKeyword: (categoryId: string, keyword: string) => void;
  onCreateCategory: (name: string, keyword: string) => void;
  onReprocess: () => void;
}

interface AddedKeyword {
  keyword: string;
  categoryId: string;
  categoryName: string;
}

export function UnassignedList({
  unassignedTransactions,
  categories,
  onAddKeyword,
  onCreateCategory,
  onReprocess,
}: UnassignedListProps) {
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [keyword, setKeyword] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [keywordError, setKeywordError] = useState("");
  const [addedKeywords, setAddedKeywords] = useState<Map<string, AddedKeyword>>(new Map());

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const handleOpenDialog = (transaction: Transaction, isEditing: boolean = false) => {
    setSelectedTransaction(transaction);

    // If editing, pre-fill the form with existing data
    if (isEditing && addedKeywords.has(transaction.id)) {
      const added = addedKeywords.get(transaction.id)!;
      setKeyword(added.keyword);
      setSelectedCategoryId(added.categoryId);
      setIsCreatingNew(false);
    } else {
      setKeyword("");
      setSelectedCategoryId("");
      setIsCreatingNew(false);
    }

    setNewCategoryName("");
    setKeywordError("");
  };

  const handleCloseDialog = () => {
    setSelectedTransaction(null);
    setKeyword("");
    setSelectedCategoryId("");
    setIsCreatingNew(false);
    setNewCategoryName("");
    setKeywordError("");
  };

  const handleKeywordChange = (value: string) => {
    setKeyword(value);
    setKeywordError("");
  };

  const checkKeywordExists = (keyword: string): { exists: boolean; categoryName?: string; categoryId?: string } => {
    const keywordLower = keyword.toLowerCase();

    for (const category of categories) {
      if (category.keywords.some(k => k.toLowerCase() === keywordLower)) {
        return { exists: true, categoryName: category.name, categoryId: category.id };
      }
    }

    return { exists: false };
  };

  const handleReprocess = () => {
    setAddedKeywords(new Map());
    onReprocess();
  };

  // Group transactions by matchField
  const groupedTransactions = unassignedTransactions.reduce((acc, transaction) => {
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

    return {
      matchField,
      transactions,
      count: transactions.length,
      totalOut,
      totalIn,
      hasKeyword,
      addedKeyword,
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

    if (!trimmedKeyword) {
      setKeywordError("Please enter a keyword");
      return;
    }

    // Validate that keyword exists in match field
    if (selectedTransaction) {
      const matchFieldLower = selectedTransaction.matchField.toLowerCase();
      const keywordLower = trimmedKeyword.toLowerCase();

      if (!matchFieldLower.includes(keywordLower)) {
        setKeywordError(`"${trimmedKeyword}" not found in the description. Please enter a keyword that appears in the text above.`);
        return;
      }
    }

    // Check if keyword already exists in another category
    const existsCheck = checkKeywordExists(trimmedKeyword);
    if (existsCheck.exists) {
      if (!isCreatingNew && selectedCategoryId === existsCheck.categoryId) {
        // Same category, this is fine
      } else {
        setKeywordError(`"${trimmedKeyword}" already exists in the "${existsCheck.categoryName}" category. Each keyword can only exist in one category to avoid conflicts.`);
        return;
      }
    }

    if (isCreatingNew) {
      if (!newCategoryName.trim()) return;
      onCreateCategory(newCategoryName.trim(), trimmedKeyword);
    } else {
      if (!selectedCategoryId) return;
      onAddKeyword(selectedCategoryId, trimmedKeyword);
    }

    // Apply to all transactions with the same matchField
    if (selectedTransaction) {
      const category = categories.find(c => c.id === (isCreatingNew ? "new" : selectedCategoryId));
      const newMap = new Map(addedKeywords);

      // Find all transactions with the same matchField
      const matchingTransactions = unassignedTransactions.filter(
        t => t.matchField === selectedTransaction.matchField
      );

      // Add keyword tracking for all matching transactions
      matchingTransactions.forEach(t => {
        newMap.set(t.id, {
          keyword: trimmedKeyword,
          categoryId: isCreatingNew ? "new" : selectedCategoryId,
          categoryName: isCreatingNew ? newCategoryName.trim() : (category?.name || ""),
        });
      });

      setAddedKeywords(newMap);
    }

    handleCloseDialog();
  };

  if (unassignedTransactions.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Unassigned Transactions</span>
            <Badge variant="secondary">{unassignedTransactions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            These transactions did not match any keywords. Add keywords to
            categorize them automatically.
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactionGroups.map((group) => (
                <TableRow key={group.matchField}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(group.date)}
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
                      <span className="text-destructive">
                        -{formatCurrency(group.totalOut)}
                      </span>
                    ) : (
                      <span className="text-green-500">
                        +{formatCurrency(group.totalIn)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {group.hasKeyword ? (
                      <TooltipProvider>
                        <div className="flex items-center gap-2">
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGroupClick(group.transactions)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Keyword
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {addedKeywords.size > 0 && (
                <span>
                  {addedKeywords.size} keyword{addedKeywords.size !== 1 ? 's' : ''} added
                </span>
              )}
            </p>
            <Button onClick={handleReprocess}>Reprocess Transactions</Button>
          </div>
        </CardContent>
      </Card>

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
            <div className="space-y-4">
              {/* Transaction Details */}
              <div className="p-4 bg-secondary rounded-lg">
                <h4 className="text-sm font-medium mb-2">Transaction Details</h4>
                <p className="text-sm">
                  <span className="font-medium">Description:</span>{" "}
                  {selectedTransaction.description}
                </p>
                <p className="text-sm mt-1">
                  <span className="font-medium">Match Field:</span>
                </p>
                <code className="text-xs bg-muted px-3 py-2 rounded block mt-1 break-all font-mono">
                  {selectedTransaction.matchField}
                </code>
              </div>

              {/* Category Selection */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="existing-category"
                    checked={!isCreatingNew}
                    onChange={() => setIsCreatingNew(false)}
                  />
                  <Label htmlFor="existing-category">
                    Add to existing category
                  </Label>
                </div>

                {!isCreatingNew && (
                  <Select
                    value={selectedCategoryId}
                    onValueChange={setSelectedCategoryId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="new-category"
                    checked={isCreatingNew}
                    onChange={() => setIsCreatingNew(true)}
                  />
                  <Label htmlFor="new-category">Create new category</Label>
                </div>

                {isCreatingNew && (
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category name"
                  />
                )}
              </div>

              {/* Keyword Input */}
              <div>
                <Label htmlFor="keyword-input">
                  Keyword (extract from description above)
                </Label>
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
                    Tip: Choose a unique part of the description that identifies
                    this type of transaction.
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
              disabled={
                !keyword.trim() ||
                (!isCreatingNew && !selectedCategoryId) ||
                (isCreatingNew && !newCategoryName.trim())
              }
            >
              Add Keyword
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
