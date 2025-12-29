"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { BankSourceBadge } from "@/components/BankSourceBadge";
import { Check, X } from "lucide-react";
import { Transaction } from "@/lib/types";
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

  return (
    <TransactionTable>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="text-right">Status</TableHead>
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
            <TableCell>
              <BankSourceBadge source={transaction.source} size="sm" />
            </TableCell>
            <TableCell className="text-right">
              <TooltipProvider>
                <div className="flex items-center justify-end gap-2">
                  {transaction.importDuplicate ? (
                    <>
                      <Badge variant="default" className="text-primary-foreground">
                        Importing
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => onSkip(transaction.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Skip this duplicate</TooltipContent>
                      </Tooltip>
                    </>
                  ) : transaction.skipDuplicate ? (
                    <>
                      <Badge variant="secondary">
                        Skipped
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => onImport(transaction.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Import anyway</TooltipContent>
                      </Tooltip>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline">
                        Pending
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => onSkip(transaction.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Skip this duplicate</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => onImport(transaction.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Import anyway</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              </TooltipProvider>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </TransactionTable>
  );
}

// Bulk action buttons component for use in ResolveSection
interface DuplicateBulkActionsProps {
  onSkipAll: () => void;
  onImportAll: () => void;
}

export function DuplicateBulkActions({ onSkipAll, onImportAll }: DuplicateBulkActionsProps) {
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={onSkipAll}
      >
        <X className="h-4 w-4 mr-1" />
        Skip All
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onImportAll}
      >
        <Check className="h-4 w-4 mr-1" />
        Import All
      </Button>
    </>
  );
}
