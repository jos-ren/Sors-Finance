/**
 * Client-side API Wrappers
 *
 * Barrel export for all client-side database operations.
 * These functions call the API routes instead of directly accessing IndexedDB.
 */

// Settings
export {
  getSetting,
  setSetting,
  getAllSettings,
} from "./settings";

// Categories
export {
  getCategories,
  getCategoryById,
  addCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  addKeywordToCategory,
  removeKeywordFromCategory,
  getExcludedCategory,
  getUncategorizedCategory,
} from "./categories";

// Imports
export {
  getImports,
  addImport,
  updateImport,
  deleteImport,
} from "./imports";

// Budgets
export {
  getBudgets,
  getBudgetForCategory,
  setBudget,
  deleteBudget,
  copyBudgetToMonth,
  findPreviousMonthWithBudgets,
  autoCopyBudgetsIfEmpty,
  applyBudgetToPreviousMonths,
} from "./budgets";

// Transactions
export {
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  deleteTransactionsBulk,
  addTransactionsBulk,
  categorizeTransaction,
  recategorizeTransactions,
  findDuplicateSignatures,
  getSpendingByCategory,
  getYTDSpendingByCategory,
  getTotalSpending,
  getAllTimeTotals,
  getAllTimeSpendingByCategory,
  getAllTimeMonthlyTrend,
  getMonthlyTrend,
  getDailyTrend,
  getTransactionCount,
  getAvailablePeriods,
} from "./transactions";

// Portfolio
export {
  // Accounts
  getPortfolioAccounts,
  getPortfolioAccountById,
  addPortfolioAccount,
  updatePortfolioAccount,
  deletePortfolioAccount,
  reorderPortfolioAccounts,
  // Items
  getPortfolioItems,
  getPortfolioItemById,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  restorePortfolioItem,
  reorderPortfolioItems,
  getTickerModeItems,
  // Snapshots
  getPortfolioSnapshots,
  getLatestPortfolioSnapshot,
  createPortfolioSnapshot,
  deletePortfolioSnapshot,
  updatePortfolioSnapshot,
  hasSnapshotToday,
  getTodaySnapshot,
  // Summary
  getNetWorthSummary,
  getBucketBreakdown,
  getBucketTotal,
  getPortfolioAccountTotal,
  getNetWorthChange,
} from "./portfolio";
