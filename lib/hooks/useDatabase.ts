import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import {
  db,
  DbCategory,
  DbTransaction,
  DbBudget,
  DbImport,
  DbPortfolioAccount,
  DbPortfolioItem,
  DbPortfolioSnapshot,
  BucketType,
  getCategories,
  getBudgets,
  getTransactions,
  getImports,
  getSpendingByCategory,
  getTotalSpending,
  getAllTimeTotals,
  getAllTimeSpendingByCategory,
  getAllTimeMonthlyTrend,
  initializeDatabase,
  getExcludedCategory,
  getPortfolioAccounts,
  getPortfolioItems,
  getPortfolioSnapshots,
  getNetWorthSummary,
  getBucketTotal,
  getPortfolioAccountTotal,
  getNetWorthChange,
  SYSTEM_CATEGORIES,
  BUCKET_TYPES
} from '../db';

// ============================================
// Database Initialization Hook
// ============================================

export function useInitDatabase() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    initializeDatabase()
      .then(() => setIsReady(true))
      .catch((err) => {
        console.error('Failed to initialize database:', err);
        setError(err);
      });
  }, []);

  return { isReady, error };
}

// ============================================
// Category Hooks
// ============================================

export function useCategories(): DbCategory[] | undefined {
  return useLiveQuery(() => getCategories());
}

export function useCategory(id: number | undefined): DbCategory | undefined {
  return useLiveQuery(
    () => (id !== undefined ? db.categories.get(id) : undefined),
    [id]
  );
}

// ============================================
// Transaction Hooks
// ============================================

export function useTransactions(options?: {
  startDate?: Date;
  endDate?: Date;
  categoryId?: number;
  source?: 'CIBC' | 'AMEX' | 'Manual';
  limit?: number;
}): DbTransaction[] | undefined {
  return useLiveQuery(
    () => getTransactions(options),
    [options?.startDate, options?.endDate, options?.categoryId, options?.source, options?.limit]
  );
}

export function useTransactionCount(): number | undefined {
  return useLiveQuery(() => db.transactions.count());
}

export function useTransactionsByMonth(year: number, month: number): DbTransaction[] | undefined {
  return useLiveQuery(() => {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);
    return getTransactions({ startDate, endDate });
  }, [year, month]);
}

// ============================================
// Budget Hooks
// ============================================

export function useBudgets(year: number, month?: number | null): DbBudget[] | undefined {
  return useLiveQuery(
    () => getBudgets(year, month),
    [year, month]
  );
}

export function useBudgetWithSpending(year: number, month: number) {
  const budgets = useBudgets(year, month);
  const categories = useCategories();

  const spending = useLiveQuery(async () => {
    return getSpendingByCategory(year, month);
  }, [year, month]);

  if (!budgets || !categories || !spending) {
    return undefined;
  }

  return budgets.map(budget => {
    const category = categories.find(c => c.id === budget.categoryId);
    const spent = spending.get(budget.categoryId) || 0;

    return {
      ...budget,
      categoryName: category?.name || 'Unknown',
      spent,
      remaining: budget.amount - spent,
      percentUsed: budget.amount > 0 ? (spent / budget.amount) * 100 : 0,
      isOverBudget: spent > budget.amount,
      isNearLimit: spent >= budget.amount * 0.9 && spent <= budget.amount
    };
  });
}

// ============================================
// Import Hooks
// ============================================

export function useImports(): DbImport[] | undefined {
  return useLiveQuery(() => getImports());
}

// ============================================
// Dashboard/Aggregation Hooks
// ============================================

export function useMonthlyTotals(year: number, month: number) {
  return useLiveQuery(
    () => getTotalSpending(year, month),
    [year, month]
  );
}

export function useYearlyTotals(year: number) {
  return useLiveQuery(
    () => getTotalSpending(year),
    [year]
  );
}

export function useSpendingByCategory(year: number, month?: number) {
  const categories = useCategories();

  const spending = useLiveQuery(
    () => getSpendingByCategory(year, month),
    [year, month]
  );

  if (!categories || !spending) {
    return undefined;
  }

  return categories.map(category => ({
    categoryId: category.id!,
    categoryName: category.name,
    amount: spending.get(category.id!) || 0
  })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
}

// ============================================
// All-Time Aggregation Hooks
// ============================================

export function useAllTimeTotals() {
  return useLiveQuery(() => getAllTimeTotals());
}

export function useAllTimeSpendingByCategory() {
  const categories = useCategories();

  const spending = useLiveQuery(
    () => getAllTimeSpendingByCategory()
  );

  if (!categories || !spending) {
    return undefined;
  }

  return categories.map(category => ({
    categoryId: category.id!,
    categoryName: category.name,
    amount: spending.get(category.id!) || 0
  })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
}

export function useAllTimeMonthlyTrend() {
  return useLiveQuery(() => getAllTimeMonthlyTrend());
}

// ============================================
// Category Mutation Hooks
// ============================================

export {
  addCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  addKeywordToCategory,
  removeKeywordFromCategory,
  recategorizeTransactions,
  updateTransaction,
  SYSTEM_CATEGORIES
} from '../db';

export type { RecategorizeMode, RecategorizeResult, UpdateCategoryResult } from '../db';

// Hook to get the Excluded category
export function useExcludedCategory(): DbCategory | undefined {
  return useLiveQuery(() => getExcludedCategory());
}

export function useMonthlyTrend(year: number) {
  return useLiveQuery(async () => {
    const months = [];
    for (let month = 0; month < 12; month++) {
      const totals = await getTotalSpending(year, month);
      months.push({
        month,
        monthName: new Date(year, month).toLocaleDateString('en-US', { month: 'short' }),
        income: totals.income,
        expenses: totals.expenses
      });
    }
    return months;
  }, [year]);
}

export function useDailyTrend(year: number, month: number) {
  return useLiveQuery(async () => {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);
    const daysInMonth = endDate.getDate();

    // Get excluded category
    const excludedCategory = await db.categories.where('name').equals('Excluded').first();
    const excludedCategoryId = excludedCategory?.id;

    // Get all transactions for the month
    const transactions = await db.transactions
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();

    // Group by day
    const dailyData: { [day: number]: { income: number; expenses: number } } = {};

    for (let day = 1; day <= daysInMonth; day++) {
      dailyData[day] = { income: 0, expenses: 0 };
    }

    for (const t of transactions) {
      if (t.categoryId !== excludedCategoryId) {
        const day = t.date.getDate();
        dailyData[day].income += t.amountIn;
        dailyData[day].expenses += t.amountOut;
      }
    }

    // Convert to array
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return {
        day,
        dayName: day.toString(),
        income: dailyData[day].income,
        expenses: dailyData[day].expenses
      };
    });
  }, [year, month]);
}

// Hook to get available years and months that have transaction data
export function useAvailablePeriods() {
  return useLiveQuery(async () => {
    const transactions = await db.transactions.toArray();

    if (transactions.length === 0) {
      return { years: [], monthsByYear: new Map<number, number[]>() };
    }

    const monthsByYear = new Map<number, Set<number>>();

    for (const t of transactions) {
      const year = t.date.getFullYear();
      const month = t.date.getMonth();

      if (!monthsByYear.has(year)) {
        monthsByYear.set(year, new Set());
      }
      monthsByYear.get(year)!.add(month);
    }

    // Convert sets to sorted arrays
    const result = new Map<number, number[]>();
    const years: number[] = [];

    for (const [year, months] of monthsByYear) {
      years.push(year);
      result.set(year, Array.from(months).sort((a, b) => a - b));
    }

    years.sort((a, b) => b - a); // Most recent first

    return { years, monthsByYear: result };
  }, []);
}

// ============================================
// Portfolio Account Hooks
// ============================================

export function usePortfolioAccounts(bucket?: BucketType): DbPortfolioAccount[] | undefined {
  return useLiveQuery(
    () => getPortfolioAccounts(bucket),
    [bucket]
  );
}

export function usePortfolioAccount(id: number | undefined): DbPortfolioAccount | undefined {
  return useLiveQuery(
    () => (id !== undefined ? db.portfolioAccounts.get(id) : undefined),
    [id]
  );
}

// ============================================
// Portfolio Item Hooks
// ============================================

export function usePortfolioItems(accountId?: number, includeInactive = false): DbPortfolioItem[] | undefined {
  return useLiveQuery(
    () => getPortfolioItems(accountId, includeInactive),
    [accountId, includeInactive]
  );
}

export function usePortfolioItem(id: number | undefined): DbPortfolioItem | undefined {
  return useLiveQuery(
    () => (id !== undefined ? db.portfolioItems.get(id) : undefined),
    [id]
  );
}

export function usePortfolioItemsByBucket(bucket: BucketType): DbPortfolioItem[] | undefined {
  return useLiveQuery(async () => {
    const accounts = await getPortfolioAccounts(bucket);
    const accountIds = accounts.map(a => a.id!);

    if (accountIds.length === 0) return [];

    const items = await db.portfolioItems
      .where('accountId')
      .anyOf(accountIds)
      .filter(i => i.isActive)
      .toArray();

    return items.sort((a, b) => a.order - b.order);
  }, [bucket]);
}

// ============================================
// Portfolio Aggregation Hooks
// ============================================

export function useBucketTotal(bucket: BucketType): number | undefined {
  return useLiveQuery(
    () => getBucketTotal(bucket),
    [bucket]
  );
}

export function usePortfolioAccountTotal(accountId: number | undefined): number | undefined {
  return useLiveQuery(
    () => (accountId !== undefined ? getPortfolioAccountTotal(accountId) : Promise.resolve(0)),
    [accountId]
  );
}

export function useNetWorthSummary() {
  return useLiveQuery(() => getNetWorthSummary());
}

export function useNetWorthChange() {
  return useLiveQuery(() => getNetWorthChange());
}

// ============================================
// Portfolio Snapshot Hooks
// ============================================

export function usePortfolioSnapshots(limit?: number): DbPortfolioSnapshot[] | undefined {
  return useLiveQuery(
    () => getPortfolioSnapshots({ limit }),
    [limit]
  );
}

export function useLatestPortfolioSnapshot(): DbPortfolioSnapshot | undefined {
  return useLiveQuery(() => db.portfolioSnapshots.orderBy('date').last());
}

export function useNetWorthHistory(months: number = 12) {
  return useLiveQuery(async () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    return getPortfolioSnapshots({ startDate, endDate });
  }, [months]);
}

// ============================================
// Portfolio Mutation Exports
// ============================================

export {
  addPortfolioAccount,
  updatePortfolioAccount,
  deletePortfolioAccount,
  reorderPortfolioAccounts,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  restorePortfolioItem,
  reorderPortfolioItems,
  createPortfolioSnapshot,
  deletePortfolioSnapshot,
  getTickerModeItems,
  hasSnapshotToday,
  getTodaySnapshot,
  BUCKET_TYPES
} from '../db';

export type { BucketType, DbPortfolioAccount, DbPortfolioItem, DbPortfolioSnapshot, AddPortfolioItemData, PriceMode } from '../db';

// Export snapshot with price refresh function
export { createSnapshotWithPriceRefresh } from './useStockPrice';
export type { SnapshotResult, RefreshAllResult } from './useStockPrice';
