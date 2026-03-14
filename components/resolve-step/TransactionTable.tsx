"use client";

import React from "react";
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
import { usePrivacy } from "@/lib/privacy-context";
import { useCurrency } from "@/lib/settings-context";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";
export { formatDate } from "@/lib/formatters";

// Reusable cell components
interface DateCellProps {
  date: Date;
  className?: string;
}

export function DateCell({ date, className }: DateCellProps) {
  return (
    <TableCell className={cn("whitespace-nowrap pl-6", className)}>
      {formatDate(date)}
    </TableCell>
  );
}

interface DescriptionCellProps {
  description: string;
  maxWidth?: string;
  className?: string;
}

export function DescriptionCell({
  description,
  maxWidth = "max-w-xs",
  className
}: DescriptionCellProps) {
  return (
    <TableCell className={className}>
      <TooltipProvider>
        <div className={maxWidth}>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-sm truncate cursor-default">
                {description}
              </p>
            </TooltipTrigger>
            <TooltipContent className="max-w-md">
              <p>{description}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </TableCell>
  );
}

interface AmountCellProps {
  amountOut: number;
  amountIn: number;
  className?: string;
}

export function AmountCell({ amountOut, amountIn, className }: AmountCellProps) {
  const { formatAmount, isPrivacyMode } = usePrivacy();
  const userCurrency = useCurrency();

  return (
    <TableCell className={cn("whitespace-nowrap", className)}>
      {amountOut > 0 ? (
        <span className={isPrivacyMode ? "text-muted-foreground" : "text-destructive"}>
          {formatAmount(amountOut, userCurrency)}
        </span>
      ) : (
        <span className={isPrivacyMode ? "text-muted-foreground" : "text-green-600"}>
          {formatAmount(amountIn, userCurrency)}
        </span>
      )}
    </TableCell>
  );
}

// Main table wrapper with consistent styling
interface TransactionTableProps {
  children: React.ReactNode;
  maxHeight?: string;
  className?: string;
}

export function TransactionTable({
  children,
  maxHeight,
  className
}: TransactionTableProps) {
  return (
    <div className={cn(
      maxHeight && "overflow-y-auto",
      className
    )} style={maxHeight ? { maxHeight } : undefined}>
      <Table>
        {children}
      </Table>
    </div>
  );
}

// Re-export table primitives for convenience
export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
