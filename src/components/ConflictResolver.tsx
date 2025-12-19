"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Check, Pencil } from "lucide-react";
import { Transaction, Category } from "@/lib/types";

interface ConflictResolverProps {
  conflictTransactions: Transaction[];
  categories: Category[];
  onResolve: (transactionId: string, categoryId: string) => void;
}

interface ResolvedConflict {
  categoryId: string;
  categoryName: string;
}

export function ConflictResolver({
  conflictTransactions,
  categories,
  onResolve,
}: ConflictResolverProps) {
  const [resolvedConflicts, setResolvedConflicts] = useState<Map<string, ResolvedConflict>>(new Map());
  const [allConflicts, setAllConflicts] = useState<Transaction[]>([]);

  // Track all conflicts on mount or when conflicts change
  useEffect(() => {
    // Add new conflicts to the list, but keep resolved ones
    const newConflictIds = new Set(conflictTransactions.map(t => t.id));
    const existingResolved = allConflicts.filter(t => resolvedConflicts.has(t.id));
    const newConflicts = conflictTransactions.filter(t => !resolvedConflicts.has(t.id));

    // If the conflict list completely changes (like after reprocess), reset everything
    if (conflictTransactions.length > 0 && allConflicts.length > 0 &&
        !conflictTransactions.some(t => allConflicts.some(a => a.id === t.id))) {
      setResolvedConflicts(new Map());
      setAllConflicts(conflictTransactions);
    } else {
      setAllConflicts([...existingResolved, ...newConflicts]);
    }
  }, [conflictTransactions]);

  const handleResolve = (transactionId: string, categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      const newMap = new Map(resolvedConflicts);
      newMap.set(transactionId, {
        categoryId,
        categoryName: category.name,
      });
      setResolvedConflicts(newMap);
      onResolve(transactionId, categoryId);
    }
  };

  const handleEdit = (transactionId: string) => {
    const newMap = new Map(resolvedConflicts);
    newMap.delete(transactionId);
    setResolvedConflicts(newMap);
  };

  const unresolvedCount = allConflicts.filter(t => !resolvedConflicts.has(t.id)).length;
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

  const getConflictingCategories = (transaction: Transaction): Category[] => {
    if (!transaction.conflictingCategories) return [];
    return categories.filter((cat) =>
      transaction.conflictingCategories?.includes(cat.id)
    );
  };

  if (allConflicts.length === 0 && conflictTransactions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Resolve Conflicts</span>
          <Badge variant="destructive">{unresolvedCount}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          These transactions matched multiple categories. Please select the
          correct category for each.
        </p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Matching Categories</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allConflicts.map((transaction) => {
              const conflicting = getConflictingCategories(transaction);
              return (
                <TableRow key={transaction.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(transaction.date)}
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <div className="max-w-xs">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-sm truncate cursor-default">
                              {transaction.description}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md">
                            <p>{transaction.description}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-xs text-muted-foreground truncate cursor-default">
                              {transaction.matchField}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md">
                            <p>{transaction.matchField}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {transaction.amountOut > 0 ? (
                      <span className="text-destructive">
                        -{formatCurrency(transaction.amountOut)}
                      </span>
                    ) : (
                      <span className="text-green-600">
                        +{formatCurrency(transaction.amountIn)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {conflicting.map((cat) => (
                        <Badge key={cat.id} variant="outline">
                          {cat.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {resolvedConflicts.has(transaction.id) ? (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">
                          {resolvedConflicts.get(transaction.id)!.categoryName}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(transaction.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Select
                        onValueChange={(value) =>
                          handleResolve(transaction.id, value)
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {conflicting.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
