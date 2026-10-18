/**
 * Client-side API wrapper for monthly budget rows (item-based).
 *
 * Budgets attach to budget items and are always monthly (yearly mode is gone).
 */

import type { DbBudget } from "../types";

export async function getBudgets(year: number, month: number): Promise<DbBudget[]> {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  const res = await fetch(`/api/budgets?${params}`);
  if (!res.ok) throw new Error("Failed to fetch budgets");
  const { data } = await res.json();
  return data.map((b: DbBudget) => ({
    ...b,
    createdAt: new Date(b.createdAt),
    updatedAt: new Date(b.updatedAt),
  }));
}

/** Upsert a monthly planned amount for a budget item. Returns the row id. */
export async function setBudget(
  budgetItemId: number,
  year: number,
  month: number,
  amount: number
): Promise<number> {
  const res = await fetch("/api/budgets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ budgetItemId, year, month, amount }),
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
  fromMonth: number,
  toYear: number,
  toMonth: number
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

export interface BudgetPeriod {
  year: number;
  /** 0-based */
  month: number;
}

/** An earlier month a budget can be copied into; `hasBudget` means copying replaces it. */
export interface ApplyTarget extends BudgetPeriod {
  hasBudget: boolean;
}

async function postApplyToPrevious<T>(body: object): Promise<T> {
  const res = await fetch("/api/budgets/apply-to-previous", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to apply budget to earlier months");
  return json.data;
}

/** Earlier months (with transactions or an existing budget) a month's budget could be copied into. */
export async function getApplyTargets(fromYear: number, fromMonth: number): Promise<ApplyTarget[]> {
  const data = await postApplyToPrevious<{ months: ApplyTarget[] }>({ fromYear, fromMonth });
  return data.months;
}

/** Copy a month's budget into the chosen earlier months, replacing any budget they already have. */
export async function applyBudgetToMonths(
  fromYear: number,
  fromMonth: number,
  months: BudgetPeriod[]
): Promise<{ months: BudgetPeriod[]; copied: number }> {
  return postApplyToPrevious({ fromYear, fromMonth, months });
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
