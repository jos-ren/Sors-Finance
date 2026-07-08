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

// Categories (system-only now: Income / Excluded / Uncategorized).
export {
  getCategories,
  getCategoryById,
  updateCategory,
  addKeywordToCategory,
  removeKeywordFromCategory,
  getExcludedCategory,
  getUncategorizedCategory,
  getIncomeCategory,
} from "./categories";

// Imports
export {
  getImports,
  addImport,
  updateImport,
  deleteImport,
} from "./imports";

// Budgets (item-based, monthly)
export {
  getBudgets,
  setBudget,
  deleteBudget,
  copyBudgetToMonth,
  findPreviousMonthWithBudgets,
  autoCopyBudgetsIfEmpty,
} from "./budgets";

// Planned income (manual expected-income override, monthly)
export { getPlannedIncome, setPlannedIncome } from "./planned-income";

// Budget hierarchy (Category Groups → Categories)
export {
  seedDefaultBudget,
  getBudgetHierarchy,
  createGroup,
  updateGroup,
  deleteGroup,
  reorderGroups,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  reorderSubcategories,
  archiveSubcategory,
  restoreSubcategory,
  addKeywordToSubcategory,
  removeKeywordFromSubcategory,
} from "./budget-hierarchy";
export type { BudgetHierarchy, CreateCategoryInput, UpdateCategoryInput } from "./budget-hierarchy";

// Budget tree + yearly summary
export { getBudgetTree, getYearlySummary } from "./budget-tree";

// Goals (sinking funds)
export { getGoals, getGoal } from "./goals";

// Transactions
export {
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  deleteTransactionsBulk,
  deleteAllTransactions,
  addTransactionsBulk,
  categorizeTransaction,
  findDuplicateSignatures,
  getSpendingByCategory,
  getYTDSpendingByCategory,
  getIncomeTotal,
  getGoalProgress,
  getTotalSpending,
  getAllTimeTotals,
  getAllTimeSpendingByCategory,
  getAllTimeMonthlyTrend,
  getMonthlyTrend,
  getMonthlyByCategory,
  getAllTimeMonthlyByCategory,
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
  getPortfolioSnapshotsPage,
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
