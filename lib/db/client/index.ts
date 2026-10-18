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

// Keywords
export { deleteAllKeywords } from "./keywords";

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
  getApplyTargets,
  applyBudgetToMonths,
  findPreviousMonthWithBudgets,
  autoCopyBudgetsIfEmpty,
} from "./budgets";

// Home summary (bills / saving / spending for a month)
export { getHomeSummary } from "./home";

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
  addPlaidDetails,
  getSpendingByCategory,
  getYTDSpendingByCategory,
  getIncomeTotal,
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

// Projects (time-bound labels on transactions)
export {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  setTransactionsProject,
} from "./projects";
