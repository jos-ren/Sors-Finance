/**
 * Client-side API wrapper for transaction operations
 */

import type { DbTransaction, RecategorizeResult, RecategorizeMode } from "../types";

interface GetTransactionsOptions {
  startDate?: Date;
  endDate?: Date;
  categoryId?: number;
  source?: string;
  limit?: number;
  offset?: number;
}

export async function getTransactions(options?: GetTransactionsOptions): Promise<DbTransaction[]> {
  const params = new URLSearchParams();

  if (options?.startDate) params.append("startDate", options.startDate.toISOString());
  if (options?.endDate) params.append("endDate", options.endDate.toISOString());
  if (options?.categoryId) params.append("categoryId", String(options.categoryId));
  if (options?.source) params.append("source", options.source);
  if (options?.limit) params.append("limit", String(options.limit));
  if (options?.offset) params.append("offset", String(options.offset));

  const res = await fetch(`/api/transactions?${params}`);
  if (!res.ok) throw new Error("Failed to fetch transactions");
  const { data } = await res.json();
  return data.map((t: DbTransaction) => ({
    ...t,
    date: new Date(t.date),
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
  }));
}

export async function addTransaction(transaction: Omit<DbTransaction, "id" | "uuid" | "createdAt" | "updatedAt">): Promise<number> {
  const res = await fetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transaction),
  });
  if (!res.ok) throw new Error("Failed to create transaction");
  const { data } = await res.json();
  return data.id;
}

export async function updateTransaction(
  id: number,
  updates: Partial<Omit<DbTransaction, "id" | "uuid" | "createdAt">>
): Promise<void> {
  const res = await fetch(`/api/transactions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update transaction");
}

export async function deleteTransaction(id: number): Promise<void> {
  const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete transaction");
}

export async function deleteTransactionsBulk(ids: number[]): Promise<void> {
  const res = await fetch("/api/transactions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Failed to delete transactions");
}

export async function addTransactionsBulk(
  transactions: Array<Omit<DbTransaction, "id" | "uuid" | "createdAt" | "updatedAt">>,
  options?: { skipDuplicates?: boolean }
): Promise<{ inserted: number; skipped: number; total: number }> {
  const res = await fetch("/api/transactions/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transactions,
      skipDuplicates: options?.skipDuplicates ?? true,
    }),
  });
  if (!res.ok) throw new Error("Failed to bulk insert transactions");
  const { data } = await res.json();
  return data;
}

export async function categorizeTransaction(id: number, categoryId: number | null): Promise<void> {
  await updateTransaction(id, { categoryId });
}

export async function recategorizeTransactions(mode: RecategorizeMode = "uncategorized"): Promise<RecategorizeResult> {
  const res = await fetch("/api/transactions/recategorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error("Failed to recategorize transactions");
  const { data } = await res.json();
  return data;
}

export async function findDuplicateSignatures(
  transactions: Array<{ date: Date; description: string; amountOut: number; amountIn: number }>
): Promise<Set<string>> {
  // Get all existing transactions
  const existing = await getTransactions();

  const existingSignatures = new Set(
    existing.map((t) => {
      const date = t.date.toISOString().split("T")[0];
      return `${date}|${t.description}|${t.amountOut}|${t.amountIn}`;
    })
  );

  const duplicates = new Set<string>();
  for (const t of transactions) {
    // Handle both Date objects and ISO string dates
    const dateStr = t.date instanceof Date 
      ? t.date.toISOString().split("T")[0] 
      : String(t.date).split("T")[0];
    const sig = `${dateStr}|${t.description}|${t.amountOut}|${t.amountIn}`;
    if (existingSignatures.has(sig)) {
      duplicates.add(sig);
    }
  }

  return duplicates;
}

// Aggregation functions
export async function getSpendingByCategory(year: number, month?: number): Promise<Map<number, number>> {
  const params = new URLSearchParams({
    type: "spending",
    year: String(year),
  });
  if (month !== undefined) params.append("month", String(month));

  const res = await fetch(`/api/transactions/aggregations?${params}`);
  if (!res.ok) throw new Error("Failed to fetch spending");
  const { data } = await res.json();
  return new Map(Object.entries(data).map(([k, v]) => [Number(k), v as number]));
}

export async function getYTDSpendingByCategory(year: number): Promise<Map<number, number>> {
  const params = new URLSearchParams({
    type: "ytdSpending",
    year: String(year),
  });

  const res = await fetch(`/api/transactions/aggregations?${params}`);
  if (!res.ok) throw new Error("Failed to fetch YTD spending");
  const { data } = await res.json();
  return new Map(Object.entries(data).map(([k, v]) => [Number(k), v as number]));
}

export async function getTotalSpending(year: number, month?: number): Promise<{ income: number; expenses: number }> {
  const params = new URLSearchParams({
    type: "totals",
    year: String(year),
  });
  if (month !== undefined) params.append("month", String(month));

  const res = await fetch(`/api/transactions/aggregations?${params}`);
  if (!res.ok) throw new Error("Failed to fetch totals");
  const { data } = await res.json();
  return data;
}

export async function getAllTimeTotals(): Promise<{ income: number; expenses: number }> {
  const res = await fetch("/api/transactions/aggregations?type=allTimeTotals");
  if (!res.ok) throw new Error("Failed to fetch all-time totals");
  const { data } = await res.json();
  return data;
}

export async function getAllTimeSpendingByCategory(): Promise<Map<number, number>> {
  const res = await fetch("/api/transactions/aggregations?type=allTimeByCategory");
  if (!res.ok) throw new Error("Failed to fetch all-time spending by category");
  const { data } = await res.json();
  return new Map(Object.entries(data).map(([k, v]) => [Number(k), v as number]));
}

export async function getAllTimeMonthlyTrend(): Promise<
  Array<{ year: number; month: number; monthName: string; income: number; expenses: number }>
> {
  const res = await fetch("/api/transactions/aggregations?type=allTimeMonthlyTrend");
  if (!res.ok) throw new Error("Failed to fetch all-time monthly trend");
  const { data } = await res.json();
  return data;
}

export async function getMonthlyTrend(year: number): Promise<
  Array<{ month: number; monthName: string; income: number; expenses: number }>
> {
  const params = new URLSearchParams({ type: "monthlyTrend", year: String(year) });
  const res = await fetch(`/api/transactions/aggregations?${params}`);
  if (!res.ok) throw new Error("Failed to fetch monthly trend");
  const { data } = await res.json();
  return data;
}

export async function getDailyTrend(year: number, month: number): Promise<
  Array<{ day: number; dayName: string; income: number; expenses: number }>
> {
  const params = new URLSearchParams({
    type: "dailyTrend",
    year: String(year),
    month: String(month),
  });
  const res = await fetch(`/api/transactions/aggregations?${params}`);
  if (!res.ok) throw new Error("Failed to fetch daily trend");
  const { data } = await res.json();
  return data;
}

export async function getTransactionCount(year?: number, month?: number): Promise<number> {
  const params = new URLSearchParams({ type: "count" });
  if (year !== undefined) params.append("year", String(year));
  if (month !== undefined) params.append("month", String(month));

  const res = await fetch(`/api/transactions/aggregations?${params}`);
  if (!res.ok) throw new Error("Failed to fetch transaction count");
  const { data } = await res.json();
  return data;
}

export async function getAvailablePeriods(): Promise<{
  years: number[];
  monthsByYear: Record<number, number[]>;
}> {
  const res = await fetch("/api/transactions/aggregations?type=availablePeriods");
  if (!res.ok) throw new Error("Failed to fetch available periods");
  const { data } = await res.json();
  return data;
}
