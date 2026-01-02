/**
 * Database Hooks - SWR Version
 *
 * React hooks for database operations using SWR for caching and reactivity.
 * All data is fetched from the API routes which access SQLite via Drizzle.
 */

import useSWR, { mutate } from "swr";
import { useEffect, useState } from "react";
import * as api from "../db/client";
import type {
  DbCategory,
  DbTransaction,
  DbBudget,
  DbImport,
  DbPortfolioAccount,
  DbPortfolioItem,
  DbPortfolioSnapshot,
  BucketType,
  RecategorizeMode,
  RecategorizeResult,
  UpdateCategoryResult,
  AddPortfolioItemData,
  PriceMode,
} from "../db/types";
import { SYSTEM_CATEGORIES, BUCKET_TYPES } from "../db/types";

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
  mutate((key: string) => typeof key === "string" && key.startsWith("transactions"), undefined, {
    revalidate: true,
  });
}

export function invalidateBudgets() {
  mutate((key: string) => typeof key === "string" && key.startsWith("budgets"), undefined, {
    revalidate: true,
  });
}

export function invalidateImports() {
  mutate("imports");
}

export function invalidatePortfolio() {
  mutate((key: string) => typeof key === "string" && key.startsWith("portfolio"), undefined, {
    revalidate: true,
  });
}

export function invalidateAll() {
  mutate(() => true, undefined, { revalidate: true });
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
  source?: "CIBC" | "AMEX" | "Manual";
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

export function useBudgets(year: number, month?: number | null): DbBudget[] | undefined {
  const { data } = useSWR(
    `budgets/${year}/${month ?? "yearly"}`,
    () => api.getBudgets(year, month),
    swrConfig
  );
  return data;
}

export function useBudgetWithSpending(year: number, month: number) {
  const budgets = useBudgets(year, month);
  const categories = useCategories();
  const spending = useSpendingByCategory(year, month);

  if (!budgets || !categories || !spending) {
    return undefined;
  }

  return budgets.map((budget) => {
    const category = categories.find((c) => c.id === budget.categoryId);
    const spent = spending.get(budget.categoryId) || 0;

    return {
      ...budget,
      categoryName: category?.name || "Unknown",
      spent,
      remaining: budget.amount - spent,
      percentUsed: budget.amount > 0 ? (spent / budget.amount) * 100 : 0,
      isOverBudget: spent > budget.amount,
      isNearLimit: spent >= budget.amount * 0.9 && spent <= budget.amount,
    };
  });
}

// ============================================
// Budget Page Data Types
// ============================================

export interface BudgetCategoryRow {
  categoryId: number;
  categoryName: string;
  isSystemCategory: boolean;
  monthlyBudget: number | null;
  monthlyBudgetId: number | null;
  yearlyBudget: number | null;
  yearlyBudgetId: number | null;
  currentMonthSpending: number;
  ytdSpending: number;
  yearlySpending: number;
  monthlyAllowance: number | null;
  rollingBalance: number | null;
  paceStatus: "under" | "on" | "over" | null;
}

export interface BudgetPageSummary {
  totalMonthlyBudgeted: number;
  totalYearlyBudgeted: number;
  totalMonthlySpent: number;
  totalYtdSpent: number;
  monthlyRemaining: number;
  yearlyRemaining: number;
}

export interface BudgetPageData {
  rows: BudgetCategoryRow[];
  summary: BudgetPageSummary;
}

export function useBudgetPageData(year: number, month: number): BudgetPageData | undefined {
  const categories = useCategories();
  const monthlyBudgets = useBudgets(year, month);
  const yearlyBudgets = useBudgets(year, null);

  const { data: currentMonthSpending } = useSWR(
    `spending/${year}/${month}`,
    () => api.getSpendingByCategory(year, month),
    swrConfig
  );

  const { data: ytdSpending } = useSWR(
    `ytdSpending/${year}`,
    () => api.getYTDSpendingByCategory(year),
    swrConfig
  );

  const { data: yearlySpending } = useSWR(
    `spending/${year}/all`,
    () => api.getSpendingByCategory(year),
    swrConfig
  );

  if (
    !categories ||
    !monthlyBudgets ||
    !yearlyBudgets ||
    !currentMonthSpending ||
    !ytdSpending ||
    !yearlySpending
  ) {
    return undefined;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let monthsElapsed: number;
  if (year < currentYear) {
    monthsElapsed = 12;
  } else if (year > currentYear) {
    monthsElapsed = 0;
  } else {
    monthsElapsed = currentMonth + 1;
  }

  const rows: BudgetCategoryRow[] = categories
    .filter((c) => !c.isSystem)
    .map((category) => {
      const monthlyBudget = monthlyBudgets.find((b) => b.categoryId === category.id);
      const yearlyBudget = yearlyBudgets.find((b) => b.categoryId === category.id);

      const monthlyAmount = monthlyBudget?.amount ?? null;
      const yearlyAmount = yearlyBudget?.amount ?? null;

      const monthSpent = currentMonthSpending.get(category.id!) || 0;
      const ytdSpent = ytdSpending.get(category.id!) || 0;
      const yearSpent = yearlySpending.get(category.id!) || 0;

      let monthlyAllowance: number | null = null;
      let rollingBalance: number | null = null;
      let paceStatus: "under" | "on" | "over" | null = null;

      if (yearlyAmount !== null && monthsElapsed > 0) {
        monthlyAllowance = yearlyAmount / 12;
        const cumulativeBudget = monthlyAllowance * monthsElapsed;
        rollingBalance = cumulativeBudget - ytdSpent;

        if (rollingBalance > monthlyAllowance * 0.1) {
          paceStatus = "under";
        } else if (rollingBalance < -monthlyAllowance * 0.1) {
          paceStatus = "over";
        } else {
          paceStatus = "on";
        }
      }

      return {
        categoryId: category.id!,
        categoryName: category.name,
        isSystemCategory: category.isSystem ?? false,
        monthlyBudget: monthlyAmount,
        monthlyBudgetId: monthlyBudget?.id ?? null,
        yearlyBudget: yearlyAmount,
        yearlyBudgetId: yearlyBudget?.id ?? null,
        currentMonthSpending: monthSpent,
        ytdSpending: ytdSpent,
        yearlySpending: yearSpent,
        monthlyAllowance,
        rollingBalance,
        paceStatus,
      };
    });

  const summary: BudgetPageSummary = {
    totalMonthlyBudgeted: rows.reduce((sum, r) => sum + (r.monthlyBudget || 0), 0),
    totalYearlyBudgeted: rows.reduce((sum, r) => sum + (r.yearlyBudget || 0), 0),
    totalMonthlySpent: rows.reduce((sum, r) => sum + r.currentMonthSpending, 0),
    totalYtdSpent: rows.reduce((sum, r) => sum + r.ytdSpending, 0),
    monthlyRemaining: 0,
    yearlyRemaining: 0,
  };
  summary.monthlyRemaining = summary.totalMonthlyBudgeted - summary.totalMonthlySpent;
  summary.yearlyRemaining = summary.totalYearlyBudgeted - summary.totalYtdSpent;

  return { rows, summary };
}

// ============================================
// Import Hooks
// ============================================

export function useImports(): DbImport[] | undefined {
  const { data } = useSWR("imports", () => api.getImports(), swrConfig);
  return data;
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

export function useSpendingByCategory(year: number, month?: number) {
  const categories = useCategories();

  const { data: spending } = useSWR(
    `spending/${year}/${month ?? "all"}`,
    () => api.getSpendingByCategory(year, month),
    swrConfig
  );

  if (!categories || !spending) {
    return undefined;
  }

  return spending;
}

export function useSpendingByCategoryWithNames(year: number, month?: number) {
  const categories = useCategories();
  const spending = useSpendingByCategory(year, month);

  if (!categories || !spending) {
    return undefined;
  }

  return categories
    .map((category) => ({
      categoryId: category.id!,
      categoryName: category.name,
      amount: spending.get(category.id!) || 0,
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
  const categories = useCategories();

  const { data: spending } = useSWR(
    "spending/allTime",
    () => api.getAllTimeSpendingByCategory(),
    swrConfig
  );

  if (!categories || !spending) {
    return undefined;
  }

  return categories
    .map((category) => ({
      categoryId: category.id!,
      categoryName: category.name,
      amount: spending.get(category.id!) || 0,
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

// Categories
export async function addCategory(name: string, keywords: string[] = []): Promise<number> {
  const id = await api.addCategory(name, keywords);
  invalidateCategories();
  return id;
}

export async function updateCategory(
  id: number,
  updates: Partial<Omit<DbCategory, "id" | "uuid" | "createdAt">>
): Promise<UpdateCategoryResult> {
  const result = await api.updateCategory(id, updates);
  invalidateCategories();
  invalidateTransactions();
  return result;
}

export async function deleteCategory(id: number): Promise<void> {
  await api.deleteCategory(id);
  invalidateCategories();
  invalidateTransactions();
  invalidateBudgets();
}

export async function reorderCategories(activeId: number, overId: number): Promise<void> {
  await api.reorderCategories(activeId, overId);
  invalidateCategories();
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

export async function recategorizeTransactions(
  mode: RecategorizeMode = "uncategorized"
): Promise<RecategorizeResult> {
  const result = await api.recategorizeTransactions(mode);
  invalidateTransactions();
  return result;
}

// Budgets
export async function setBudget(
  categoryId: number,
  year: number,
  month: number | null,
  amount: number
): Promise<number> {
  const id = await api.setBudget(categoryId, year, month, amount);
  invalidateBudgets();
  return id;
}

export async function deleteBudget(id: number): Promise<void> {
  await api.deleteBudget(id);
  invalidateBudgets();
}

export async function copyBudgetToMonth(
  fromYear: number,
  fromMonth: number | null,
  toYear: number,
  toMonth: number | null
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

export async function getBudgetForCategory(
  categoryId: number,
  year: number,
  month?: number | null
): Promise<DbBudget | null> {
  return api.getBudgetForCategory(categoryId, year, month);
}

// Re-export constants and types
export { SYSTEM_CATEGORIES, BUCKET_TYPES };
export type { RecategorizeMode, RecategorizeResult, UpdateCategoryResult, BucketType, PriceMode, AddPortfolioItemData };
export type { DbCategory, DbTransaction, DbBudget, DbImport, DbPortfolioAccount, DbPortfolioItem, DbPortfolioSnapshot };

// Re-export from useStockPrice (this will need to be updated separately)
export { createSnapshotWithPriceRefresh } from "./useStockPrice";
export type { SnapshotResult, RefreshAllResult } from "./useStockPrice";

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
  transactions: Array<{ date: Date; description: string; amountOut: number; amountIn: number }>
): Promise<Set<string>> {
  return api.findDuplicateSignatures(transactions);
}
