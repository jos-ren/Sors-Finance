/**
 * Database Module
 *
 * Central export for all database operations.
 * Import from "@/lib/db" to access all database functionality.
 */

// Database instance
export { db } from "./instance";

// Types
export type {
  DbCategory,
  DbTransaction,
  DbBudget,
  DbImport,
  DbSettings,
  DbPortfolioAccount,
  DbPortfolioItem,
  DbPortfolioSnapshot,
  BucketType,
  PriceMode,
  AddPortfolioItemData,
  UpdateCategoryResult,
  RecategorizeMode,
  RecategorizeResult,
} from "./types";

export { SYSTEM_CATEGORIES, BUCKET_TYPES } from "./types";

// Category operations
export {
  getCategories,
  getCategoryById,
  getCategoryByUuid,
  getExcludedCategory,
  getUncategorizedCategory,
  addCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  addKeywordToCategory,
  removeKeywordFromCategory,
} from "./categories";

// Transaction operations
export {
  getTransactions,
  addTransaction,
  addTransactionsBulk,
  updateTransaction,
  deleteTransaction,
  deleteTransactionsBulk,
  categorizeTransaction,
  findDuplicateSignatures,
  recategorizeTransactions,
  getSpendingByCategory,
  getYTDSpendingByCategory,
  getTotalSpending,
  getAllTimeTotals,
  getAllTimeSpendingByCategory,
  getAllTimeMonthlyTrend,
} from "./transactions";

// Budget operations
export {
  getBudgets,
  getBudgetForCategory,
  setBudget,
  deleteBudget,
  copyBudgetToMonth,
  applyBudgetToPreviousMonths,
  findPreviousMonthWithBudgets,
  autoCopyBudgetsIfEmpty,
} from "./budgets";

// Import operations
export {
  getImports,
  addImport,
  deleteImport,
} from "./imports";

// Settings operations
export {
  getSetting,
  setSetting,
} from "./settings";

// Portfolio operations
export {
  // Account operations
  getPortfolioAccounts,
  getPortfolioAccountById,
  addPortfolioAccount,
  updatePortfolioAccount,
  deletePortfolioAccount,
  reorderPortfolioAccounts,
  // Item operations
  getPortfolioItems,
  getPortfolioItemById,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  restorePortfolioItem,
  reorderPortfolioItems,
  getTickerModeItems,
  // Aggregations
  getBucketTotal,
  getPortfolioAccountTotal,
  getNetWorthSummary,
  getBucketBreakdown,
  // Snapshot operations
  getPortfolioSnapshots,
  getLatestPortfolioSnapshot,
  createPortfolioSnapshot,
  deletePortfolioSnapshot,
  updatePortfolioSnapshot,
  getNetWorthChange,
  hasSnapshotToday,
  getTodaySnapshot,
} from "./portfolio";

// Database initialization
export {
  seedDefaultCategories,
  initializeDatabase,
} from "./seed";
