"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, Undo2 } from "lucide-react";
import { Transaction } from "@/lib/types";
import { DbCategory } from "@/lib/db";
import {
  TransactionTable,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
  DateCell,
  DescriptionCell,
  AmountCell,
} from "@/components/resolve-step";

interface ConflictResolverProps {
  conflictTransactions: Transaction[];
  categories: DbCategory[];
  onResolve: (transactionId: string, categoryId: string) => void;
  onUndo: (transactionId: string) => void;
}

export function ConflictResolver({
  conflictTransactions,
  categories,
  onResolve,
  onUndo,
}: ConflictResolverProps) {
  const getConflictingCategories = (transaction: Transaction): DbCategory[] => {
    if (!transaction.conflictingCategories) return [];
    return categories.filter((cat) =>
      transaction.conflictingCategories?.includes(cat.uuid)
    );
  };

  const getResolvedCategory = (transaction: Transaction): DbCategory | undefined => {
    if (!transaction.categoryId) return undefined;
    return categories.find(c => c.uuid === transaction.categoryId);
  };

  if (conflictTransactions.length === 0) {
    return null;
  }

  return (
    <TransactionTable>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Matching Categories</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {conflictTransactions.map((transaction) => {
          const conflicting = getConflictingCategories(transaction);
          const resolvedCategory = getResolvedCategory(transaction);
          const isResolved = !!resolvedCategory;

          return (
            <TableRow key={transaction.id}>
              <DateCell date={transaction.date} />
              <DescriptionCell description={transaction.description} />
              <AmountCell
                amountOut={transaction.amountOut}
                amountIn={transaction.amountIn}
              />
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {conflicting.map((cat) => (
                    <Badge key={cat.uuid} variant="outline">
                      {cat.name}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right">
                {isResolved ? (
                  <div className="flex items-center justify-end gap-2">
                    <Badge variant="default" className="bg-green-600">
                      <Check className="h-3 w-3 mr-1" />
                      {resolvedCategory.name}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onUndo(transaction.id)}
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Select
                    onValueChange={(value) =>
                      onResolve(transaction.id, value)
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {conflicting.map((cat) => (
                        <SelectItem key={cat.uuid} value={cat.uuid}>
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
    </TransactionTable>
  );
}
