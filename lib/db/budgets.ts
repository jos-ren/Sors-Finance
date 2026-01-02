/**
 * Budget Operations
 *
 * CRUD operations for category budgets.
 */

import { db } from "./instance";
import type { DbBudget } from "./types";

// ============================================
// Read Operations
// ============================================

export async function getBudgets(year: number, month?: number | null): Promise<DbBudget[]> {
  if (month !== undefined && month !== null) {
    // Get monthly budgets for specific month
    return db.budgets.where("[year+month]").equals([year, month]).toArray();
  }
  // Get yearly budgets only (month is null)
  return db.budgets
    .where("year")
    .equals(year)
    .filter(b => b.month === null)
    .toArray();
}

export async function getBudgetForCategory(
  categoryId: number,
  year: number,
  month?: number | null
): Promise<DbBudget | undefined> {
  if (month !== undefined && month !== null) {
    return db.budgets.where("[year+month+categoryId]").equals([year, month, categoryId]).first();
  }
  // For yearly budgets (month is null), filter manually since Dexie doesn't support null in where()
  return db.budgets
    .where("year")
    .equals(year)
    .filter(b => b.categoryId === categoryId && b.month === null)
    .first();
}

// ============================================
// Write Operations
// ============================================

export async function setBudget(
  categoryId: number,
  year: number,
  month: number | null,
  amount: number
): Promise<number> {
  const existing = await getBudgetForCategory(categoryId, year, month);

  if (existing?.id) {
    await db.budgets.update(existing.id, { amount, updatedAt: new Date() });
    return existing.id;
  }

  return db.budgets.add({
    categoryId,
    year,
    month,
    amount,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function deleteBudget(id: number): Promise<void> {
  await db.budgets.delete(id);
}

export async function copyBudgetToMonth(
  fromYear: number,
  fromMonth: number | null,
  toYear: number,
  toMonth: number | null
): Promise<void> {
  const sourceBudgets = await getBudgets(fromYear, fromMonth);

  await db.transaction("rw", db.budgets, async () => {
    for (const budget of sourceBudgets) {
      const existing = await getBudgetForCategory(budget.categoryId, toYear, toMonth);
      if (!existing) {
        await db.budgets.add({
          categoryId: budget.categoryId,
          year: toYear,
          month: toMonth,
          amount: budget.amount,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  });
}

/**
 * Apply a monthly budget to all empty months in a year (previous months only)
 * Only fills months that don't already have a budget - never overwrites existing values
 * @param categoryId - The category to apply budget to
 * @param year - The year to apply budgets in
 * @param upToMonth - Apply to months 0 through upToMonth (inclusive)
 * @param amount - The monthly budget amount
 * @returns Number of months that were filled
 */
export async function applyBudgetToPreviousMonths(
  categoryId: number,
  year: number,
  upToMonth: number,
  amount: number
): Promise<number> {
  let filledCount = 0;

  // Get all existing budgets for this category and year first
  const existingBudgets = await db.budgets
    .where("year")
    .equals(year)
    .filter(b => b.categoryId === categoryId && b.month !== null)
    .toArray();

  // Create a set of months that already have budgets
  const monthsWithBudgets = new Set(existingBudgets.map(b => b.month));

  await db.transaction("rw", db.budgets, async () => {
    for (let month = 0; month <= upToMonth; month++) {
      // Skip if this month already has a budget
      if (monthsWithBudgets.has(month)) {
        continue;
      }

      await db.budgets.add({
        categoryId,
        year,
        month,
        amount,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      filledCount++;
    }
  });

  return filledCount;
}

/**
 * Find the most recent previous month that has budget data
 * Searches backwards through months, crossing year boundaries
 * @param year - Starting year to search from
 * @param month - Starting month to search from (0-11)
 * @param maxMonthsBack - Maximum months to search back (default 24)
 * @returns The year and month with budgets, or null if none found
 */
export async function findPreviousMonthWithBudgets(
  year: number,
  month: number,
  maxMonthsBack: number = 24
): Promise<{ year: number; month: number } | null> {
  let searchYear = year;
  let searchMonth = month - 1;

  for (let i = 0; i < maxMonthsBack; i++) {
    // Handle year boundary
    if (searchMonth < 0) {
      searchMonth = 11;
      searchYear--;
    }

    const budgets = await getBudgets(searchYear, searchMonth);
    if (budgets.length > 0) {
      return { year: searchYear, month: searchMonth };
    }

    searchMonth--;
  }

  return null;
}

/**
 * Automatically copy budgets from a previous month if the current month is empty
 * @param year - The year to check
 * @param month - The month to check (0-11)
 * @returns True if budgets were copied, false otherwise
 */
export async function autoCopyBudgetsIfEmpty(
  year: number,
  month: number
): Promise<boolean> {
  // Check if current month already has budgets
  const currentBudgets = await getBudgets(year, month);
  if (currentBudgets.length > 0) {
    return false;
  }

  // Find the most recent month with budgets
  const previousMonth = await findPreviousMonthWithBudgets(year, month);
  if (!previousMonth) {
    return false;
  }

  // Copy budgets from previous month to current month
  await copyBudgetToMonth(previousMonth.year, previousMonth.month, year, month);
  return true;
}
