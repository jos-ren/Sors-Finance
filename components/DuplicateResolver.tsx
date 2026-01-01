"use client";

import { Transaction } from "@/lib/types";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

interface DuplicateResolverProps {
  duplicateTransactions: Transaction[];
  onImport: (transactionId: string) => void;
  onSkip: (transactionId: string) => void;
}

export function DuplicateResolver({
  duplicateTransactions,
  onImport,
  onSkip,
}: DuplicateResolverProps) {
  if (duplicateTransactions.length === 0) {
    return null;
  }

  const getValue = (transaction: Transaction) => {
    if (transaction.importDuplicate) return "import";
    if (transaction.skipDuplicate) return "skip";
    return "skip"; // Default to skip
  };

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
        {duplicateTransactions.map((transaction) => (
          <TableRow key={transaction.id}>
            <DateCell date={transaction.date} />
            <DescriptionCell description={transaction.description} />
            <AmountCell
              amountOut={transaction.amountOut}
              amountIn={transaction.amountIn}
            />
            <TableCell className="text-right pr-6">
              <div className="flex justify-end">
                <ToggleGroup
                  type="single"
                  value={getValue(transaction)}
                  onValueChange={(value) => {
                    if (value === "import") {
                      onImport(transaction.id);
                    } else if (value === "skip") {
                      onSkip(transaction.id);
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="h-7"
                >
                  <ToggleGroupItem value="skip" className="text-xs px-3 h-7">
                    Skip
                  </ToggleGroupItem>
                  <ToggleGroupItem value="import" className="text-xs px-3 h-7">
                    Import
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </TransactionTable>
  );
}
