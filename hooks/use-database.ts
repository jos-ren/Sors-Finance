/**
 * Database Hooks - SWR Version
 *
 * React hooks for database operations using SWR for caching and reactivity.
 * All data is fetched from the API routes which access SQLite via Drizzle.
 */

import useSWR, { mutate } from "swr";
import { useEffect, useState } from "react";
import * as api from "@/lib/db/client";
import { useBudgetHierarchy } from "./use-budget";
import type {
  DbCategory,
  DbTransaction,
  DbBudget,
  DbImport,
  DbImportDraft,
  DbPortfolioAccount,
  DbPortfolioItem,
  DbPortfolioSnapshot,
  DbPortfolioItemHistory,
  BucketType,
  UpdateCategoryResult,
  AddPortfolioItemData,
  PriceMode,
  ItemType,
  HistorySource,
} from "@/lib/db/types";
import { SYSTEM_CATEGORIES, BUCKET_TYPES } from "@/lib/db/types";

// ============================================
// SWR Configuration
// ============================================

const swrConfig = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
};

// ============================================
// Cache Invalidation Helpers
// ============================================

export function invalidateCategories() {
  mutate("categories");
}

export function invalidateTransactions() {
  // Invalidate transaction queries
  mutate((key: string) => typeof key === "string" && key.startsWith("transactions"));
  mutate((key: string) => typeof key === "string" && key.startsWith("budget-item-tx"));
  // Also invalidate dashboard aggregations that depend on transactions
  mutate((key: string) => typeof key === "string" && key.startsWith("totals"));
  mutate((key: string) => typeof key === "string" && key.startsWith("spending"));
  mutate((key: string) => typeof key === "string" && key.startsWith("trend"));
  mutate((key: string) => typeof key === "string" && key.startsWith("ytdSpending"));
  mutate("periods");
  // Actuals feed the budget tree/yearly views + income + goal progress.
  mutate((key: string) => typeof key === "string" && key.startsWith("budget-tree"));
  mutate((key: string) => typeof key === "string" && key.startsWith("budget-yearly"));
  mutate((key: string) => typeof key === "string" && key.startsWith("income"));
  mutate("goal-progress");
}

export function invalidateBudgets() {
  mutate((key: string) => typeof key === "string" && key.startsWith("budgets"));
  mutate((key: string) => typeof key === "string" && key.startsWith("budget-tree"));
  mutate((key: string) => typeof key === "string" && key.startsWith("budget-yearly"));
}

export function invalidateImports() {
  mutate("imports");
}

export function invalidatePortfolio() {
  mutate((key: string) => typeof key === "string" && key.startsWith("portfolio"));
}

export function invalidateAll() {
  mutate(() => true);
}

// ============================================
// Database Initialization Hook
// ============================================

export function useInitDatabase() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // With SQLite, the database is always ready on the server
    // We just need to check if the API is accessible
    fetch("/api/settings")
      .then((res) => {
        if (res.ok) {
          setIsReady(true);
        } else if (res.status === 401) {
          // User is not authenticated - this is fine, auth will handle redirect
          // Mark as ready so we don't block rendering
          setIsReady(true);
        } else {
          throw new Error("API not ready");
        }
      })
      .catch((err) => {
        console.error("Failed to initialize database:", err);
        setError(err);
      });
  }, []);

  return { isReady, error };
}

// ============================================
// Category Hooks
// ============================================

export function useCategories(): DbCategory[] | undefined {
  const { data } = useSWR("categories", () => api.getCategories(), swrConfig);
  return data;
}

export function useCategory(id: number | undefined): DbCategory | undefined {
  const { data } = useSWR(
    id !== undefined ? `categories/${id}` : null,
    () => (id !== undefined ? api.getCategoryById(id) : null),
    swrConfig
  );
  return data ?? undefined;
}

export function useExcludedCategory(): DbCategory | undefined {
  const categories = useCategories();
  return categories?.find((c) => c.name === SYSTEM_CATEGORIES.EXCLUDED);
}

// ============================================
// Transaction Hooks
// ============================================

export function useTransactions(options?: {
  startDate?: Date;
  endDate?: Date;
  categoryId?: number;
  budgetItemId?: number;
  source?: string;
  limit?: number;
}): DbTransaction[] | undefined {
  const key = options
    ? `transactions?${JSON.stringify(options)}`
    : "transactions";

  const { data } = useSWR(key, () => api.getTransactions(options), swrConfig);
  return data;
}

export function useTransactionCount(): number | undefined {
  const { data } = useSWR("transactions/count", () => api.getTransactionCount(), swrConfig);
  return data;
}

export function useTransactionCountByPeriod(year: number, month?: number): number | undefined {
  const { data } = useSWR(
    `transactions/count/${year}/${month ?? "all"}`,
    () => api.getTransactionCount(year, month),
    swrConfig
  );
  return data;
}

export function useTransactionsByMonth(year: number, month: number): DbTransaction[] | undefined {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);
  return useTransactions({ startDate, endDate });
}

// ============================================
// Budget Hooks
// ============================================

/** Monthly budget rows (item-based). Yearly mode is gone; use the budget tree
 *  hooks in use-budget.ts for the budget page. */
export function useBudgets(year: number, month: number): DbBudget[] | undefined {
  const { data } = useSWR(`budgets/${year}/${month}`, () => api.getBudgets(year, month), swrConfig);
  return data;
}

// Re-export the hierarchy/tree hooks so existing `@/hooks` imports resolve.
export {
  useBudgetHierarchy,
  useBudgetTree,
  useYearlyBudgetSummary,
  useArchivedBudgetCategories,
  useGoalProgress,
  useIncomeTotal,
  usePlannedIncome,
  setPlannedIncomeAmount,
} from "./use-budget";

// Goals (sinking funds)
export { useGoals, useGoal, invalidateGoals } from "./use-goals";

// ============================================
// Import Hooks
// ============================================

export function useImports(): DbImport[] | undefined {
  const { data } = useSWR("imports", () => api.getImports(), swrConfig);
  return data;
}

export function useImportDrafts(): DbImportDraft[] | undefined {
  const { data } = useSWR("import-drafts", () => api.getImportDrafts(), swrConfig);
  return data;
}

export function invalidateImportDrafts() {
  mutate("import-drafts");
}

// ============================================
// Dashboard/Aggregation Hooks
// ============================================

export function useMonthlyTotals(year: number, month: number) {
  const { data } = useSWR(
    `totals/${year}/${month}`,
    () => api.getTotalSpending(year, month),
    swrConfig
  );
  return data;
}

export function useYearlyTotals(year: number) {
  const { data } = useSWR(`totals/${year}/all`, () => api.getTotalSpending(year), swrConfig);
  return data;
}

/**
 * Map of budget category id → name (archived included), for resolving names on
 * the dashboard's spending aggregations, which are now keyed by budget category id.
 */
export function useBudgetItemNames(): Map<number, string> | undefined {
  const hierarchy = useBudgetHierarchy(true);
  if (!hierarchy) return undefined;
  return new Map(hierarchy.subcategories.map((c) => [c.id!, c.name]));
}

export function useSpendingByCategory(year: number, month?: number) {
  const { data } = useSWR(
    `spending/${year}/${month ?? "all"}`,
    () => api.getSpendingByCategory(year, month),
    swrConfig
  );
  return data;
}

export function useSpendingByCategoryWithNames(year: number, month?: number) {
  const names = useBudgetItemNames();
  const spending = useSpendingByCategory(year, month);

  if (!names || !spending) {
    return undefined;
  }

  return Array.from(spending.entries())
    .map(([itemId, amount]) => ({
      categoryId: itemId,
      categoryName: names.get(itemId) ?? "Unknown",
      amount,
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

// ============================================
// All-Time Aggregation Hooks
// ============================================

export function useAllTimeTotals() {
  const { data } = useSWR("totals/allTime", () => api.getAllTimeTotals(), swrConfig);
  return data;
}

export function useAllTimeSpendingByCategory() {
  const names = useBudgetItemNames();

  const { data: spending } = useSWR(
    "spending/allTime",
    () => api.getAllTimeSpendingByCategory(),
    swrConfig
  );

  if (!names || !spending) {
    return undefined;
  }

  return Array.from(spending.entries())
    .map(([itemId, amount]) => ({
      categoryId: itemId,
      categoryName: names.get(itemId) ?? "Unknown",
      amount,
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function useAllTimeMonthlyTrend() {
  const { data } = useSWR("trend/allTime", () => api.getAllTimeMonthlyTrend(), swrConfig);
  return data;
}

export function useMonthlyTrend(year: number) {
  const { data } = useSWR(`trend/monthly/${year}`, () => api.getMonthlyTrend(year), swrConfig);
  return data;
}

export interface CategoryTrendRow {
  label: string;
  categoryTotals: Record<number, number>;
}

export function useMonthlyByCategoryForYear(year: number): CategoryTrendRow[] | undefined {
  const { data } = useSWR(
    `trend/monthlyByCategory/${year}`,
    () => api.getMonthlyByCategory(year),
    swrConfig
  );
  return data?.map((r) => ({ label: r.monthName, categoryTotals: r.categoryTotals }));
}

export function useAllTimeMonthlyByCategory(minMonths?: number): CategoryTrendRow[] | undefined {
  const { data } = useSWR(
    "trend/allTimeMonthlyByCategory",
    () => api.getAllTimeMonthlyByCategory(),
    swrConfig
  );

  if (!data) {
    return undefined;
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const rows = [...data];

  // Pad with future months (never past ones) if there isn't enough history to fill minMonths
  if (minMonths && rows.length < minMonths) {
    if (rows.length === 0) {
      const now = new Date();
      for (let i = 0; i < minMonths; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        rows.push({ year: d.getFullYear(), month: d.getMonth(), monthName: monthNames[d.getMonth()], categoryTotals: {} });
      }
    } else {
      const deficit = minMonths - rows.length;
      const last = rows[rows.length - 1];
      for (let i = 1; i <= deficit; i++) {
        const d = new Date(last.year, last.month + i, 1);
        rows.push({ year: d.getFullYear(), month: d.getMonth(), monthName: monthNames[d.getMonth()], categoryTotals: {} });
      }
    }
  }

  return rows.map((r) => ({ label: `${r.monthName} ${r.year}`, categoryTotals: r.categoryTotals }));
}

export interface MonthlyExpenseCategorySeries {
  categoryId: number;
  categoryName: string;
  total: number;
}

export function buildCategoryChartData(
  rows: CategoryTrendRow[] | undefined,
  // Now keyed by budget item; accepts any { id, name } list (items or categories).
  namedEntities: Array<{ id?: number | null; name: string }> | undefined
): {
  chartRows: Array<Record<string, number | string>>;
  categorySeries: MonthlyExpenseCategorySeries[];
} | undefined {
  if (!rows || !namedEntities) {
    return undefined;
  }

  const totalsByCategory = new Map<number, number>();
  for (const row of rows) {
    for (const [categoryIdStr, amount] of Object.entries(row.categoryTotals)) {
      const categoryId = Number(categoryIdStr);
      totalsByCategory.set(categoryId, (totalsByCategory.get(categoryId) || 0) + amount);
    }
  }

  const categorySeries: MonthlyExpenseCategorySeries[] = namedEntities
    .map((entity) => ({
      categoryId: entity.id!,
      categoryName: entity.name,
      total: totalsByCategory.get(entity.id!) || 0,
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const chartRows = rows.map((row) => {
    const chartRow: Record<string, number | string> = {
      month: row.label,
    };
    for (const series of categorySeries) {
      chartRow[series.categoryName] = row.categoryTotals[series.categoryId] || 0;
    }
    return chartRow;
  });

  return { chartRows, categorySeries };
}

export function useDailyTrend(year: number, month: number) {
  const { data } = useSWR(
    `trend/daily/${year}/${month}`,
    () => api.getDailyTrend(year, month),
    swrConfig
  );
  return data;
}

export function useAvailablePeriods() {
  const { data } = useSWR("periods", () => api.getAvailablePeriods(), swrConfig);

  if (!data) {
    return undefined;
  }

  return {
    years: data.years,
    monthsByYear: new Map(Object.entries(data.monthsByYear).map(([k, v]) => [Number(k), v])),
  };
}

// ============================================
// Portfolio Account Hooks
// ============================================

export function usePortfolioAccounts(bucket?: BucketType): DbPortfolioAccount[] | undefined {
  const { data } = useSWR(
    `portfolio/accounts${bucket ? `/${bucket}` : ""}`,
    () => api.getPortfolioAccounts(bucket),
    swrConfig
  );
  return data;
}

export function usePortfolioAccount(id: number | undefined): DbPortfolioAccount | undefined {
  const { data } = useSWR(
    id !== undefined ? `portfolio/accounts/${id}` : null,
    () => (id !== undefined ? api.getPortfolioAccountById(id) : null),
    swrConfig
  );
  return data ?? undefined;
}

// ============================================
// Portfolio Item Hooks
// ============================================

export function usePortfolioItems(
  accountId?: number,
  includeInactive = false
): DbPortfolioItem[] | undefined {
  const { data } = useSWR(
    `portfolio/items${accountId ? `/${accountId}` : ""}${includeInactive ? "?inactive" : ""}`,
    () => api.getPortfolioItems(accountId, includeInactive),
    swrConfig
  );
  return data;
}

export function usePortfolioItem(id: number | undefined): DbPortfolioItem | undefined {
  const { data } = useSWR(
    id !== undefined ? `portfolio/items/${id}` : null,
    () => (id !== undefined ? api.getPortfolioItemById(id) : null),
    swrConfig
  );
  return data ?? undefined;
}

/**
 * Get all portfolio items across all accounts
 */
export function useAllPortfolioItems(includeInactive = false): DbPortfolioItem[] | undefined {
  return usePortfolioItems(undefined, includeInactive);
}

export function usePortfolioItemsByBucket(bucket: BucketType): DbPortfolioItem[] | undefined {
  const accounts = usePortfolioAccounts(bucket);
  const items = usePortfolioItems();

  if (!accounts || !items) {
    return undefined;
  }

  const accountIds = new Set(accounts.map((a) => a.id));
  return items.filter((i) => i.isActive && accountIds.has(i.accountId));
}

// ============================================
// Portfolio Aggregation Hooks
// ============================================

export function useBucketTotal(bucket: BucketType): number | undefined {
  const { data } = useSWR(
    `portfolio/bucketTotal/${bucket}`,
    () => api.getBucketTotal(bucket),
    swrConfig
  );
  return data;
}

export function usePortfolioAccountTotal(accountId: number | undefined): number | undefined {
  const { data } = useSWR(
    accountId !== undefined ? `portfolio/accountTotal/${accountId}` : null,
    () => (accountId !== undefined ? api.getPortfolioAccountTotal(accountId) : 0),
    swrConfig
  );
  return data;
}

export function useNetWorthSummary() {
  const { data } = useSWR("portfolio/summary", () => api.getNetWorthSummary(), swrConfig);
  return data;
}

export function useNetWorthChange() {
  const { data } = useSWR("portfolio/change", () => api.getNetWorthChange(), swrConfig);
  return data;
}

// ============================================
// Portfolio Snapshot Hooks
// ============================================

export function usePortfolioSnapshots(limit?: number): DbPortfolioSnapshot[] | undefined {
  const { data } = useSWR(
    `portfolio/snapshots${limit ? `?limit=${limit}` : ""}`,
    () => api.getPortfolioSnapshots({ limit }),
    swrConfig
  );
  return data;
}

export function usePortfolioSnapshotsPage(page: number, pageSize: number) {
  const { data, isLoading } = useSWR(
    `portfolio/snapshots/page/${page}/${pageSize}`,
    () => api.getPortfolioSnapshotsPage({ limit: pageSize, offset: page * pageSize }),
    swrConfig
  );
  return {
    snapshots: data?.data,
    total: data?.total,
    isLoading,
  };
}

export function useLatestPortfolioSnapshot(): DbPortfolioSnapshot | undefined {
  const { data } = useSWR(
    "portfolio/snapshots/latest",
    () => api.getLatestPortfolioSnapshot(),
    swrConfig
  );
  return data ?? undefined;
}

export function useNetWorthHistory(months: number = 12) {
  const { data } = useSWR(`portfolio/history/${months}`, async () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    return api.getPortfolioSnapshots({ startDate, endDate });
  }, swrConfig);
  return data;
}

// ============================================
// Mutation Functions with Cache Invalidation
// ============================================

// Categories — system categories only now; just keyword edits are supported.
export async function updateCategory(
  id: number,
  updates: Partial<Omit<DbCategory, "id" | "uuid" | "createdAt">>
): Promise<UpdateCategoryResult> {
  const result = await api.updateCategory(id, updates);
  invalidateCategories();
  invalidateTransactions();
  return result;
}

export async function addKeywordToCategory(categoryId: number, keyword: string): Promise<void> {
  await api.addKeywordToCategory(categoryId, keyword);
  invalidateCategories();
}

export async function removeKeywordFromCategory(categoryId: number, keyword: string): Promise<void> {
  await api.removeKeywordFromCategory(categoryId, keyword);
  invalidateCategories();
}

// Transactions
export async function addTransaction(
  transaction: Omit<DbTransaction, "id" | "uuid" | "createdAt" | "updatedAt">
): Promise<number> {
  const id = await api.addTransaction(transaction);
  invalidateTransactions();
  return id;
}

export async function updateTransaction(
  id: number,
  updates: Partial<Omit<DbTransaction, "id" | "uuid" | "createdAt">>
): Promise<void> {
  await api.updateTransaction(id, updates);
  invalidateTransactions();
}

export async function deleteTransaction(id: number): Promise<void> {
  await api.deleteTransaction(id);
  invalidateTransactions();
}

export async function deleteTransactionsBulk(ids: number[]): Promise<void> {
  await api.deleteTransactionsBulk(ids);
  invalidateTransactions();
}

export async function deleteAllTransactions(): Promise<{ deleted: number }> {
  const result = await api.deleteAllTransactions();
  invalidateTransactions();
  return result;
}

// Budgets (item-based, monthly)
export async function setBudget(
  budgetItemId: number,
  year: number,
  month: number,
  amount: number
): Promise<number> {
  const id = await api.setBudget(budgetItemId, year, month, amount);
  invalidateBudgets();
  return id;
}

export async function deleteBudget(id: number): Promise<void> {
  await api.deleteBudget(id);
  invalidateBudgets();
}

export async function copyBudgetToMonth(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number
): Promise<number> {
  const count = await api.copyBudgetToMonth(fromYear, fromMonth, toYear, toMonth);
  invalidateBudgets();
  return count;
}

// Portfolio
export async function addPortfolioAccount(bucket: BucketType, name: string): Promise<number> {
  const id = await api.addPortfolioAccount(bucket, name);
  invalidatePortfolio();
  return id;
}

export async function updatePortfolioAccount(id: number, updates: { name: string }): Promise<void> {
  await api.updatePortfolioAccount(id, updates);
  invalidatePortfolio();
}

export async function deletePortfolioAccount(id: number): Promise<void> {
  await api.deletePortfolioAccount(id);
  invalidatePortfolio();
}

export async function reorderPortfolioAccounts(
  bucket: BucketType,
  activeId: number,
  overId: number
): Promise<void> {
  await api.reorderPortfolioAccounts(bucket, activeId, overId);
  invalidatePortfolio();
}

export async function addPortfolioItem(data: AddPortfolioItemData): Promise<number> {
  const id = await api.addPortfolioItem(data);
  invalidatePortfolio();
  return id;
}

export async function updatePortfolioItem(
  id: number,
  updates: Partial<Omit<DbPortfolioItem, "id" | "uuid" | "createdAt">>
): Promise<void> {
  await api.updatePortfolioItem(id, updates);
  invalidatePortfolio();
}

export async function deletePortfolioItem(id: number, hard = false): Promise<void> {
  await api.deletePortfolioItem(id, hard);
  invalidatePortfolio();
}

export async function restorePortfolioItem(id: number): Promise<void> {
  await api.restorePortfolioItem(id);
  invalidatePortfolio();
}

export async function reorderPortfolioItems(
  accountId: number,
  activeId: number,
  overId: number
): Promise<void> {
  await api.reorderPortfolioItems(accountId, activeId, overId);
  invalidatePortfolio();
}

export async function createPortfolioSnapshot(): Promise<number> {
  const id = await api.createPortfolioSnapshot();
  invalidatePortfolio();
  return id;
}

export async function deletePortfolioSnapshot(id: number): Promise<void> {
  await api.deletePortfolioSnapshot(id);
  invalidatePortfolio();
}

export async function updatePortfolioSnapshot(
  id: number,
  updates: Partial<Pick<DbPortfolioSnapshot, "totalSavings" | "totalInvestments" | "totalAssets" | "totalDebt">>
): Promise<void> {
  await api.updatePortfolioSnapshot(id, updates);
  invalidatePortfolio();
}

// Settings
export async function getSetting(key: string): Promise<string | null> {
  return api.getSetting(key);
}

export async function setSetting(key: string, value: string): Promise<void> {
  await api.setSetting(key, value);
}

// Other exports
export async function getTickerModeItems(): Promise<DbPortfolioItem[]> {
  return api.getTickerModeItems();
}

export async function hasSnapshotToday(): Promise<boolean> {
  return api.hasSnapshotToday();
}

export async function getTodaySnapshot(): Promise<DbPortfolioSnapshot | null> {
  return api.getTodaySnapshot();
}

export async function findPreviousMonthWithBudgets(
  year: number,
  month: number,
  maxMonthsBack?: number
): Promise<{ year: number; month: number } | null> {
  return api.findPreviousMonthWithBudgets(year, month, maxMonthsBack);
}

// Re-export constants and types
export { SYSTEM_CATEGORIES, BUCKET_TYPES };
export type { UpdateCategoryResult, BucketType, PriceMode, AddPortfolioItemData, ItemType, HistorySource };
export type { DbCategory, DbTransaction, DbBudget, DbImport, DbPortfolioAccount, DbPortfolioItem, DbPortfolioSnapshot, DbPortfolioItemHistory };

// Re-export from useStockPrice (this will need to be updated separately)
export { createSnapshotWithPriceRefresh } from './use-stock-price';
export type { SnapshotResult, RefreshAllResult } from './use-stock-price';

// Import operations
export async function addTransactionsBulk(
  transactions: Array<Omit<DbTransaction, "id" | "uuid" | "createdAt" | "updatedAt">>,
  options?: { skipDuplicates?: boolean }
): Promise<{ inserted: number; skipped: number; total: number }> {
  const result = await api.addTransactionsBulk(transactions, options);
  invalidateTransactions();
  invalidateImports();
  return result;
}

export async function addImport(importData: {
  fileName: string;
  source: string;
  transactionCount: number;
  totalAmount: number;
}): Promise<number> {
  const id = await api.addImport(importData);
  invalidateImports();
  return id;
}

export async function deleteImport(id: number): Promise<void> {
  await api.deleteImport(id);
  invalidateImports();
  invalidateTransactions();
}

export async function findDuplicateSignatures(
  transactions: Array<{ date: Date; description: string; amountOut: number; amountIn: number; source: string }>
): Promise<Set<string>> {
  return api.findDuplicateSignatures(transactions);
}

// ============================================
// Plaid Institution Status Hook
// ============================================

/** Maps plaid account ID → institution status ('active' | 'login_required' | 'error') */
export function usePlaidAccountStatuses(): Map<number, string> {
  const { data } = useSWR(
    "plaid/institution-statuses",
    async () => {
      const response = await fetch("/api/plaid/institutions");
      if (!response.ok) return [];
      const json = await response.json();
      return json.institutions || [];
    },
    { ...swrConfig, revalidateOnFocus: false }
  );

  const map = new Map<number, string>();
  if (data) {
    for (const institution of data) {
      for (const account of institution.accounts) {
        map.set(account.id, institution.status);
      }
    }
  }
  return map;
}
