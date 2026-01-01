"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
}

export function ConflictResolver({
  conflictTransactions,
  categories,
  onResolve,
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
          <TableHead className="w-[100px] pl-6">Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="w-[100px]">Amount</TableHead>
          <TableHead className="w-[200px] text-right pr-6">Status</TableHead>
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
              <TableCell className="text-right pr-6">
                <div className="flex justify-end">
                  <Select
                    value={isResolved ? resolvedCategory.uuid : undefined}
                    onValueChange={(value) => onResolve(transaction.id, value)}
                  >
                    <SelectTrigger className="w-[140px] h-7 text-xs">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {conflicting.map((cat) => (
                        <SelectItem key={cat.uuid} value={cat.uuid} className="text-xs">
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </TransactionTable>
  );
}
