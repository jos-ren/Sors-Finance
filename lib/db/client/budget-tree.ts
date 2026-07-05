/**
 * Client-side API wrapper for the budget tree + yearly summary read models.
 */

import type { BudgetTree, YearlySummary } from "@/lib/budget/types";

export async function getBudgetTree(year: number, month: number): Promise<BudgetTree> {
  const res = await fetch(`/api/budget/tree?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("Failed to fetch budget tree");
  const { data } = await res.json();
  return data as BudgetTree;
}

export async function getYearlySummary(year: number): Promise<YearlySummary> {
  const res = await fetch(`/api/budgets/yearly-summary?year=${year}`);
  if (!res.ok) throw new Error("Failed to fetch yearly summary");
  const { data } = await res.json();
  return data as YearlySummary;
}
