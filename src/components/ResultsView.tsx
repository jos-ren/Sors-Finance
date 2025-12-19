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
import { Transaction, Category, DateFilter } from "@/lib/types";
import {
  getTransactionsByCategory,
  getCategoryTotal,
  getAvailableYears,
  getAvailableMonths,
  filterTransactionsByDate,
} from "@/lib/categorizer";

interface ResultsViewProps {
  transactions: Transaction[];
  categories: Category[];
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

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case "CIBC":
        return "#c41f3f";
      case "AMEX":
        return "#026ed1";
      default:
        return undefined; // Falls back to bg-muted
    }
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
          category.id
        );

        // Sort by date (newest first)
        categoryTransactions.sort(
          (a, b) => b.date.getTime() - a.date.getTime()
        );

        const total = getCategoryTotal(filteredTransactions, category.id);

        return {
          category,
          transactions: categoryTransactions,
          total,
        };
      })
      .filter((result) => result.transactions.length > 0); // Only show categories with transactions
  }, [categories, filteredTransactions]);

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
        {categoryResults.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No categorized transactions found for the selected date range.
          </p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {categoryResults.map(({ category, transactions, total }, index) => (
              <AccordionItem
                key={category.id}
                value={category.id}
                className={index === categoryResults.length - 1 ? "border-b-0" : ""}
              >
                <AccordionTrigger>
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-medium">{category.name}</span>
                    <span
                      className={`font-semibold ${
                        total >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(total)}
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
                            <span
                              className="text-[11px] px-0.5 py-[1px] rounded font-medium inline-block w-12 text-center"
                              style={{
                                backgroundColor: getSourceBadgeColor(transaction.source),
                                color: getSourceBadgeColor(transaction.source) ? "#ffffff" : undefined,
                              }}
                            >
                              {transaction.source}
                            </span>
                          </TableCell>
                          <TableCell className="w-[140px] text-right whitespace-nowrap">
                            {transaction.amountOut > 0 ? (
                              <span className="text-destructive">
                                -{formatCurrency(transaction.amountOut)}
                              </span>
                            ) : (
                              <span className="text-green-500">
                                +{formatCurrency(transaction.amountIn)}
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
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
