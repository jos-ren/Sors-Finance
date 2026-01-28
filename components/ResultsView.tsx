"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BankSourceBadge } from "@/components/BankSourceBadge";
import { Transaction, DateFilter } from "@/lib/types";
import { usePrivacy } from "@/lib/privacy-context";
import { DbCategory } from "@/lib/db";
import {
  getTransactionsByCategory,
  getCategoryTotal,
  getAvailableYears,
  getAvailableMonths,
  filterTransactionsByDate,
} from "@/lib/categorizer";

interface ResultsViewProps {
  transactions: Transaction[];
  categories: DbCategory[];
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function ResultsView({ transactions, categories }: ResultsViewProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: "all" });
  const { formatAmount, isPrivacyMode } = usePrivacy();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  // Get available years and months from transactions
  const availableYears = useMemo(
    () => getAvailableYears(transactions),
    [transactions]
  );
  const availableMonths = useMemo(
    () => getAvailableMonths(transactions),
    [transactions]
  );

  // Filter transactions based on date filter
  const filteredTransactions = useMemo(() => {
    return filterTransactionsByDate(
      transactions,
      dateFilter.year,
      dateFilter.month
    );
  }, [transactions, dateFilter]);

  // Get category results
  const categoryResults = useMemo(() => {
    return categories
      .map((category) => {
        const categoryTransactions = getTransactionsByCategory(
          filteredTransactions,
          category.uuid
        );

        // Sort by date (newest first)
        categoryTransactions.sort(
          (a, b) => b.date.getTime() - a.date.getTime()
        );

        const total = getCategoryTotal(filteredTransactions, category.uuid);

        return {
          category,
          transactions: categoryTransactions,
          total,
        };
      })
      .filter((result) => result.transactions.length > 0); // Only show categories with transactions
  }, [categories, filteredTransactions]);

  // Get uncategorized transactions
  const uncategorizedTransactions = useMemo(() => {
    const uncategorized = filteredTransactions.filter(t => !t.categoryId);
    // Sort by date (newest first)
    uncategorized.sort((a, b) => b.date.getTime() - a.date.getTime());
    return uncategorized;
  }, [filteredTransactions]);

  const uncategorizedTotal = useMemo(() => {
    return uncategorizedTransactions.reduce((sum, t) => sum + t.netAmount, 0);
  }, [uncategorizedTransactions]);

  const handleFilterChange = (value: string) => {
    if (value === "all") {
      setDateFilter({ type: "all" });
    } else if (value.startsWith("year-")) {
      const year = parseInt(value.replace("year-", ""));
      setDateFilter({ type: "year", year });
    } else if (value.startsWith("month-")) {
      const [, yearStr, monthStr] = value.split("-");
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      setDateFilter({ type: "month", year, month });
    }
  };

  const getFilterValue = () => {
    if (dateFilter.type === "all") return "all";
    if (dateFilter.type === "year") return `year-${dateFilter.year}`;
    if (dateFilter.type === "month")
      return `month-${dateFilter.year}-${dateFilter.month}`;
    return "all";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Categorized Transactions</CardTitle>
          <Select value={getFilterValue()} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Transactions</SelectItem>
              {availableYears.length > 0 && (
                <>
                  <SelectItem disabled value="year-divider">
                    ── By Year ──
                  </SelectItem>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={`year-${year}`}>
                      {year}
                    </SelectItem>
                  ))}
                </>
              )}
              {availableMonths.length > 0 && (
                <>
                  <SelectItem disabled value="month-divider">
                    ── By Month ──
                  </SelectItem>
                  {availableMonths.map(({ year, month }) => (
                    <SelectItem
                      key={`${year}-${month}`}
                      value={`month-${year}-${month}`}
                    >
                      {MONTH_NAMES[month]} {year}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {categoryResults.length === 0 && uncategorizedTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No transactions found for the selected date range.
          </p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {categoryResults.map(({ category, transactions, total }, index) => (
              <AccordionItem
                key={category.uuid}
                value={category.uuid}
                className={index === categoryResults.length - 1 && uncategorizedTransactions.length === 0 ? "border-b-0" : ""}
              >
                <AccordionTrigger>
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-medium">{category.name}</span>
                    <span
                      className={`font-semibold ${
                        isPrivacyMode ? "text-muted-foreground" : total >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatAmount(Math.abs(total), formatCurrency)}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Date</TableHead>
                        <TableHead className="min-w-[300px]">Description</TableHead>
                        <TableHead className="w-[100px]">Source</TableHead>
                        <TableHead className="w-[140px] text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="w-[120px] whitespace-nowrap">
                            {formatDate(transaction.date)}
                          </TableCell>
                          <TableCell className="min-w-[300px]">
                            <p className="truncate">{transaction.description}</p>
                          </TableCell>
                          <TableCell className="w-[100px]">
                            <BankSourceBadge source={transaction.source} size="sm" />
                          </TableCell>
                          <TableCell className="w-[140px] text-right whitespace-nowrap">
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            ))}
            
            {/* Uncategorized transactions accordion */}
            {uncategorizedTransactions.length > 0 && (
              <AccordionItem
                value="uncategorized"
                className="border-b-0"
              >
                <AccordionTrigger>
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Uncategorized</span>
                      <Badge variant="secondary" className="text-xs">
                        {uncategorizedTransactions.length}
                      </Badge>
                    </div>
                    <span
                      className={`font-semibold ${
                        isPrivacyMode ? "text-muted-foreground" : uncategorizedTotal >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatAmount(Math.abs(uncategorizedTotal), formatCurrency)}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Date</TableHead>
                        <TableHead className="min-w-[300px]">Description</TableHead>
                        <TableHead className="w-[100px]">Source</TableHead>
                        <TableHead className="w-[140px] text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uncategorizedTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="w-[120px] whitespace-nowrap">
                            {formatDate(transaction.date)}
                          </TableCell>
                          <TableCell className="min-w-[300px]">
                            <p className="truncate">{transaction.description}</p>
                          </TableCell>
                          <TableCell className="w-[100px]">
                            <BankSourceBadge source={transaction.source} size="sm" />
                          </TableCell>
                          <TableCell className="w-[140px] text-right whitespace-nowrap">
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
