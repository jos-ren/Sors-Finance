/**
 * Transaction Operations
 *
 * CRUD operations for bank transactions.
 */

import { db } from "./instance";
import type { DbTransaction, DbCategory, RecategorizeMode, RecategorizeResult } from "./types";
import { getCategories, getExcludedCategory } from "./categories";

// ============================================
// Read Operations
// ============================================

export async function getTransactions(options?: {
  startDate?: Date;
  endDate?: Date;
  categoryId?: number;
  source?: string;
  limit?: number;
  offset?: number;
}): Promise<DbTransaction[]> {
  let query = db.transactions.orderBy("date").reverse();

  if (options?.startDate && options?.endDate) {
    query = db.transactions.where("date").between(options.startDate, options.endDate, true, true).reverse();
  }

  let results = await query.toArray();

  if (options?.categoryId !== undefined) {
    results = results.filter(t => t.categoryId === options.categoryId);
  }
  if (options?.source) {
    results = results.filter(t => t.source === options.source);
  }
  if (options?.offset) {
    results = results.slice(options.offset);
  }
  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

// ============================================
// Write Operations
// ============================================

export async function addTransaction(
  transaction: Omit<DbTransaction, "id" | "createdAt" | "updatedAt">
): Promise<number> {
  return db.transactions.add({
    ...transaction,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function addTransactionsBulk(
  transactions: Omit<DbTransaction, "id" | "createdAt" | "updatedAt">[],
  options?: { skipDuplicateCheck?: boolean }
): Promise<{ added: number; skipped: number }> {
  if (transactions.length === 0) {
    return { added: 0, skipped: 0 };
  }

  if (options?.skipDuplicateCheck) {
    const now = new Date();
    const withTimestamps = transactions.map(t => ({
      ...t,
      createdAt: now,
      updatedAt: now,
    }));
    await db.transactions.bulkAdd(withTimestamps);
    return { added: transactions.length, skipped: 0 };
  }

  const dates = transactions.map(t => t.date);
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  const existingTransactions = await db.transactions
    .where("date")
    .between(minDate, maxDate, true, true)
    .toArray();

  const existingSignatures = new Set(
    existingTransactions.map(t =>
      `${t.date.toISOString()}|${t.description}|${t.amountOut}|${t.amountIn}`
    )
  );

  const newTransactions = transactions.filter(t => {
    const signature = `${t.date.toISOString()}|${t.description}|${t.amountOut}|${t.amountIn}`;
    return !existingSignatures.has(signature);
  });

  const skipped = transactions.length - newTransactions.length;

  if (newTransactions.length > 0) {
    const now = new Date();
    const withTimestamps = newTransactions.map(t => ({
      ...t,
      createdAt: now,
      updatedAt: now,
    }));
    await db.transactions.bulkAdd(withTimestamps);
  }

  return { added: newTransactions.length, skipped };
}

export async function updateTransaction(
  id: number,
  updates: Partial<Omit<DbTransaction, "id" | "uuid" | "createdAt">>
): Promise<void> {
  await db.transactions.update(id, {
    ...updates,
    updatedAt: new Date(),
  });
}

export async function deleteTransaction(id: number): Promise<void> {
  await db.transactions.delete(id);
}

export async function deleteTransactionsBulk(ids: number[]): Promise<void> {
  await db.transactions.bulkDelete(ids);
}

export async function categorizeTransaction(id: number, categoryId: number | null): Promise<void> {
  await db.transactions.update(id, {
    categoryId,
    updatedAt: new Date(),
  });
}

// ============================================
// Duplicate Detection
// ============================================

export async function findDuplicateSignatures(
  transactions: Array<{ date: Date; description: string; amountOut: number; amountIn: number }>
): Promise<Set<string>> {
  if (transactions.length === 0) {
    return new Set();
  }

  const dates = transactions.map(t => t.date);
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  const existingTransactions = await db.transactions
    .where("date")
    .between(minDate, maxDate, true, true)
    .toArray();

  return new Set(
    existingTransactions.map(t =>
      `${t.date.toISOString()}|${t.description}|${t.amountOut}|${t.amountIn}`
    )
  );
}

// ============================================
// Re-categorization
// ============================================

export async function recategorizeTransactions(
  mode: RecategorizeMode = "uncategorized"
): Promise<RecategorizeResult> {
  const categories = await getCategories();
  const transactions = await db.transactions.toArray();

  let processed = 0;
  let updated = 0;
  let conflicts = 0;

  await db.transaction("rw", db.transactions, async () => {
    for (const transaction of transactions) {
      if (mode === "uncategorized" && transaction.categoryId !== null) {
        continue;
      }

      processed++;

      const matchingCategories = findMatchingCategoriesForText(transaction.matchField, categories);

      if (matchingCategories.length === 1) {
        if (transaction.categoryId !== matchingCategories[0].id) {
          await db.transactions.update(transaction.id!, {
            categoryId: matchingCategories[0].id!,
            updatedAt: new Date(),
          });
          updated++;
        }
      } else if (matchingCategories.length > 1) {
        conflicts++;
      }
    }
  });

  return { processed, updated, conflicts };
}

function findMatchingCategoriesForText(text: string, categories: DbCategory[]): DbCategory[] {
  const lowerText = text.toLowerCase();
  return categories.filter(category =>
    category.keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))
  );
}

// ============================================
// Aggregations
// ============================================

export async function getSpendingByCategory(year: number, month?: number): Promise<Map<number, number>> {
  let startDate: Date;
  let endDate: Date;

  if (month !== undefined) {
    startDate = new Date(year, month, 1);
    endDate = new Date(year, month + 1, 0, 23, 59, 59);
  } else {
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31, 23, 59, 59);
  }

  const excludedCategory = await getExcludedCategory();
  const excludedCategoryId = excludedCategory?.id;

  const transactions = await db.transactions
    .where("date")
    .between(startDate, endDate, true, true)
    .toArray();

  const spending = new Map<number, number>();

  for (const t of transactions) {
    if (t.categoryId !== null && t.categoryId !== excludedCategoryId && t.amountOut > 0) {
      const current = spending.get(t.categoryId) || 0;
      spending.set(t.categoryId, current + t.amountOut);
    }
  }

  return spending;
}

/**
 * Get Year-To-Date spending by category (Jan 1 to current date)
 * Used for rolling balance calculations on yearly budgets
 */
export async function getYTDSpendingByCategory(year: number): Promise<Map<number, number>> {
  const now = new Date();
  const startDate = new Date(year, 0, 1); // January 1st
  const endDate = new Date(year, now.getMonth(), now.getDate(), 23, 59, 59);

  const excludedCategory = await getExcludedCategory();
  const excludedCategoryId = excludedCategory?.id;

  const transactions = await db.transactions
    .where("date")
    .between(startDate, endDate, true, true)
    .toArray();

  const spending = new Map<number, number>();

  for (const t of transactions) {
    if (t.categoryId !== null && t.categoryId !== excludedCategoryId && t.amountOut > 0) {
      const current = spending.get(t.categoryId) || 0;
      spending.set(t.categoryId, current + t.amountOut);
    }
  }

  return spending;
}

export async function getTotalSpending(year: number, month?: number): Promise<{ income: number; expenses: number }> {
  let startDate: Date;
  let endDate: Date;

  if (month !== undefined) {
    startDate = new Date(year, month, 1);
    endDate = new Date(year, month + 1, 0, 23, 59, 59);
  } else {
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31, 23, 59, 59);
  }

  const excludedCategory = await getExcludedCategory();
  const excludedCategoryId = excludedCategory?.id;

  const transactions = await db.transactions
    .where("date")
    .between(startDate, endDate, true, true)
    .toArray();

  let income = 0;
  let expenses = 0;

  for (const t of transactions) {
    if (t.categoryId !== excludedCategoryId) {
      income += t.amountIn;
      expenses += t.amountOut;
    }
  }

  return { income, expenses };
}

export async function getAllTimeTotals(): Promise<{ income: number; expenses: number }> {
  const excludedCategory = await getExcludedCategory();
  const excludedCategoryId = excludedCategory?.id;

  const transactions = await db.transactions.toArray();

  let income = 0;
  let expenses = 0;

  for (const t of transactions) {
    if (t.categoryId !== excludedCategoryId) {
      income += t.amountIn;
      expenses += t.amountOut;
    }
  }

  return { income, expenses };
}

export async function getAllTimeSpendingByCategory(): Promise<Map<number, number>> {
  const excludedCategory = await getExcludedCategory();
  const excludedCategoryId = excludedCategory?.id;

  const transactions = await db.transactions.toArray();

  const spending = new Map<number, number>();

  for (const t of transactions) {
    if (t.categoryId !== null && t.categoryId !== excludedCategoryId && t.amountOut > 0) {
      const current = spending.get(t.categoryId) || 0;
      spending.set(t.categoryId, current + t.amountOut);
    }
  }

  return spending;
}

export async function getAllTimeMonthlyTrend(): Promise<Array<{
  month: number;
  year: number;
  monthName: string;
  income: number;
  expenses: number;
}>> {
  const excludedCategory = await getExcludedCategory();
  const excludedCategoryId = excludedCategory?.id;

  const transactions = await db.transactions.orderBy("date").toArray();

  if (transactions.length === 0) return [];

  const monthlyData = new Map<string, { income: number; expenses: number; year: number; month: number }>();

  for (const t of transactions) {
    if (t.categoryId !== excludedCategoryId) {
      const year = t.date.getFullYear();
      const month = t.date.getMonth();
      const key = `${year}-${month}`;

      if (!monthlyData.has(key)) {
        monthlyData.set(key, { income: 0, expenses: 0, year, month });
      }

      const data = monthlyData.get(key)!;
      data.income += t.amountIn;
      data.expenses += t.amountOut;
    }
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return Array.from(monthlyData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, data]) => ({
      month: data.month,
      year: data.year,
      monthName: `${monthNames[data.month]} ${data.year}`,
      income: data.income,
      expenses: data.expenses,
    }));
}
