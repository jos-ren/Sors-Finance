/**
 * Database Types
 *
 * Type definitions for all database tables and operations.
 */

// ============================================
// Category Types
// ============================================

/** How a keyword's text is compared against a transaction's matchField. */
export type KeywordMatchMode = "contains" | "startsWith" | "exact";

/** A single auto-categorization rule: text + how it's matched. */
export interface Keyword {
  text: string;
  mode: KeywordMatchMode;
}

export interface DbCategory {
  id?: number;
  uuid: string;
  name: string;
  keywords: Keyword[];
  order: number;
  isSystem?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const SYSTEM_CATEGORIES = {
  EXCLUDED: "Excluded",
  UNCATEGORIZED: "Uncategorized",
  INCOME: "Income",
} as const;

// ============================================
// Budget Hierarchy Types (Category Group → Category)
// ============================================

export type BudgetItemType = "expense" | "goal";

export interface DbBudgetGroup {
  id?: number;
  uuid: string;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/** A Category: the budgeting leaf. Carries keywords, expense/goal type, and
 *  target amount, and is what transactions/monthly budget rows attach to. */
export interface DbBudgetSubcategory {
  id?: number;
  uuid: string;
  name: string;
  groupId: number;
  keywords: Keyword[];
  itemType: BudgetItemType;
  targetAmount?: number | null;
  targetDate?: Date | null;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Transaction Types
// ============================================

export interface DbTransaction {
  id?: number;
  uuid: string;
  date: Date;
  description: string;
  matchField: string;
  amountOut: number;
  amountIn: number;
  netAmount: number;
  source: string;
  sourceMethod?: string | null; // "Plaid", "CSV", or "Manual"
  sourceAccountName?: string | null; // Specific account name for tooltip
  note?: string | null;
  categoryId: number | null;
  budgetItemId: number | null;
  categoryLocked: boolean;
  reviewStatus: "pending" | "reviewed"; // "pending" = in the ledger review inbox
  conflictCategories: string[] | null; // conflicting matchable uuids when a multi-keyword conflict
  importId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Budget Types
// ============================================

export interface DbBudget {
  id?: number;
  budgetItemId: number;
  year: number;
  month: number; // 0–11 (monthly only)
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** One flat expected-income value per month, set manually by the user. */
export interface DbPlannedIncome {
  id?: number;
  year: number;
  month: number; // 0–11
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Import Types
// ============================================

export interface DbImport {
  id?: number;
  fileName: string;
  source: string;
  transactionCount: number;
  totalAmount: number;
  batchId?: string | null;
  method?: string | null;
  importedAt: Date;
}

// ============================================
// Settings Types
// ============================================

export interface DbSettings {
  id?: number;
  key: string;
  value: string;
}

// ============================================
// Portfolio Types
// ============================================

export const BUCKET_TYPES = ["Savings", "Investments", "Assets", "Debt"] as const;
export type BucketType = (typeof BUCKET_TYPES)[number];

export type PriceMode = "manual" | "ticker";
export type TickerType = "stock" | "crypto" | "metal";
export type ItemType = "stock" | "crypto" | "metal" | "bank" | "other";
export type HistorySource = "manual" | "plaid_sync" | "price_refresh" | "created" | "deleted";

export interface DbPortfolioAccount {
  id?: number;
  uuid: string;
  bucket: BucketType;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbPortfolioItem {
  id?: number;
  uuid: string;
  accountId: number;
  name: string;
  currentValue: number;
  notes?: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  ticker?: string;
  quantity?: number;
  pricePerUnit?: number;
  currency?: string;
  lastPriceUpdate?: Date;
  priceMode?: PriceMode;
  tickerType?: TickerType;
  type?: ItemType;
  isInternational?: boolean;
  plaidAccountId?: number; // Links to Plaid account for auto-sync
}

export interface DbPortfolioSnapshot {
  id?: number;
  uuid: string;
  date: Date;
  totalSavings: number;
  totalInvestments: number;
  totalAssets: number;
  totalDebt: number;
  netWorth: number;
  details: {
    accounts: Array<{ id: number; bucket: BucketType; name: string; total: number }>;
    items: Array<{ id: number; accountId: number; name: string; value: number }>;
  };
  createdAt: Date;
}

// ============================================
// Operation Result Types
// ============================================

export interface UpdateCategoryResult {
  assigned: number;
  uncategorized: number;
  conflicts: number;
}

export interface AddPortfolioItemData {
  accountId: number;
  name: string;
  currentValue: number;
  notes?: string;
  ticker?: string;
  quantity?: number;
  pricePerUnit?: number;
  currency?: string;
  lastPriceUpdate?: Date;
  priceMode?: PriceMode;
  tickerType?: TickerType;
  type?: ItemType;
  isInternational?: boolean;
}

export interface DbPortfolioItemHistory {
  id?: number;
  itemId: number;
  source: HistorySource;
  type?: ItemType;
  changes: Array<{ field: string; oldValue: string | number | null; newValue: string | number | null }>;
  createdAt: Date;
}
