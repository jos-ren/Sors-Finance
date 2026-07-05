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

// Import Drafts
export {
  getImportDrafts,
  saveImportDraft,
  deleteImportDraft,
} from "./import-drafts";

// Budgets (item-based, monthly)
export {
  getBudgets,
  setBudget,
  deleteBudget,
  copyBudgetToMonth,
  findPreviousMonthWithBudgets,
  autoCopyBudgetsIfEmpty,
} from "./budgets";

// Budget hierarchy (groups → subcategories → items)
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
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
  archiveItem,
  restoreItem,
  addKeywordToItem,
  removeKeywordFromItem,
} from "./budget-hierarchy";
export type { BudgetHierarchy, CreateItemInput, UpdateItemInput } from "./budget-hierarchy";

// Budget tree + yearly summary
export { getBudgetTree, getYearlySummary } from "./budget-tree";

// Transactions
export {
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  deleteTransactionsBulk,
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
