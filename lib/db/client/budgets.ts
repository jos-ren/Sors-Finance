/**
 * Client-side API wrapper for budget operations
 */

import type { DbBudget } from "../types";

export async function getBudgets(year: number, month?: number | null): Promise<DbBudget[]> {
  const params = new URLSearchParams({ year: String(year) });
  if (month !== undefined && month !== null) {
    params.append("month", String(month));
  } else {
    params.append("month", "null");
  }

  const res = await fetch(`/api/budgets?${params}`);
  if (!res.ok) throw new Error("Failed to fetch budgets");
  const { data } = await res.json();
  return data.map((b: DbBudget) => ({
    ...b,
    createdAt: new Date(b.createdAt),
    updatedAt: new Date(b.updatedAt),
  }));
}

export async function getBudgetForCategory(
  categoryId: number,
  year: number,
  month?: number | null
): Promise<DbBudget | null> {
  const budgets = await getBudgets(year, month);
  return budgets.find((b) => b.categoryId === categoryId) || null;
}

export async function setBudget(
  categoryId: number,
  year: number,
  month: number | null,
  amount: number
): Promise<number> {
  const res = await fetch("/api/budgets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoryId, year, month, amount }),
  });
  if (!res.ok) throw new Error("Failed to save budget");
  const { data } = await res.json();
  return data.id;
}

export async function deleteBudget(id: number): Promise<void> {
  const res = await fetch(`/api/budgets/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete budget");
}

export async function copyBudgetToMonth(
  fromYear: number,
  fromMonth: number | null,
  toYear: number,
  toMonth: number | null
): Promise<number> {
  const res = await fetch("/api/budgets/copy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromYear, fromMonth, toYear, toMonth }),
  });
  if (!res.ok) throw new Error("Failed to copy budgets");
  const { data } = await res.json();
  return data.copied;
}

export async function findPreviousMonthWithBudgets(
  year: number,
  month: number,
  maxMonthsBack: number = 12
): Promise<{ year: number; month: number } | null> {
  let checkYear = year;
  let checkMonth = month - 1;

  for (let i = 0; i < maxMonthsBack; i++) {
    if (checkMonth < 0) {
      checkMonth = 11;
      checkYear--;
    }

    const budgets = await getBudgets(checkYear, checkMonth);
    if (budgets.length > 0) {
      return { year: checkYear, month: checkMonth };
    }

    checkMonth--;
  }

  return null;
}

export async function autoCopyBudgetsIfEmpty(year: number, month: number): Promise<boolean> {
  const currentBudgets = await getBudgets(year, month);
  if (currentBudgets.length > 0) return false;

  const previous = await findPreviousMonthWithBudgets(year, month);
  if (!previous) return false;

  const copied = await copyBudgetToMonth(previous.year, previous.month, year, month);
  return copied > 0;
}

export async function applyBudgetToPreviousMonths(
  categoryId: number,
  year: number,
  upToMonth: number,
  amount: number
): Promise<number> {
  let appliedCount = 0;

  for (let month = 0; month < upToMonth; month++) {
    const existing = await getBudgetForCategory(categoryId, year, month);
    if (!existing) {
      await setBudget(categoryId, year, month, amount);
      appliedCount++;
    }
  }

  return appliedCount;
}
