import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import {
  db,
  DbCategory,
  DbTransaction,
  DbBudget,
  DbImport,
  getCategories,
  getBudgets,
  getTransactions,
  getImports,
  getSpendingByCategory,
  getTotalSpending,
  initializeDatabase,
  getIgnoreCategory,
  updateTransaction,
  SYSTEM_CATEGORIES
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

// Hook to get the Ignore category
export function useIgnoreCategory(): DbCategory | undefined {
  return useLiveQuery(() => getIgnoreCategory());
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
