/**
 * Database Types
 *
 * Type definitions for all database tables and operations.
 */

// ============================================
// Category Types
// ============================================

export interface DbCategory {
  id?: number;
  uuid: string;
  name: string;
  keywords: string[];
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
// Budget Hierarchy Types (Group → Subcategory → Item)
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

export interface DbBudgetSubcategory {
  id?: number;
  uuid: string;
  name: string;
  groupId: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbBudgetItem {
  id?: number;
  uuid: string;
  name: string;
  subcategoryId: number;
  keywords: string[];
  itemType: BudgetItemType;
  targetAmount?: number | null;
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
// Import Draft Types
// ============================================

export interface ImportDraftData {
  currentStep: string;
  importSource: "manual" | "plaid";
  transactions: SerializedTransaction[];
  plaidEndDate: string | null;
  sectionsOpen: {
    conflicts: boolean;
    uncategorized: boolean;
    duplicates: boolean;
    categorized: boolean;
  };
  errors: string[];
  /** File metadata only (File objects can't be serialized) */
  filesMeta: Array<{
    name: string;
    bankId: string | null;
    templateName?: string;
  }>;
}

/** Transaction with date as ISO string for JSON serialization */
export interface SerializedTransaction {
  id: string;
  date: string; // ISO string
  description: string;
  matchField: string;
  amountOut: number;
  amountIn: number;
  netAmount: number;
  source: string;
  sourceMethod?: "Plaid" | "CSV" | "Manual";
  sourceAccountName?: string;
  categoryId: string | null;
  isConflict: boolean;
  conflictingCategories?: string[];
  isDuplicate?: boolean;
  importDuplicate?: boolean;
  skipDuplicate?: boolean;
  wasUncategorized?: boolean;
}

export interface DbImportDraft {
  id?: number;
  uuid: string;
  name: string;
  importSource: string;
  currentStep: string;
  transactionCount: number;
  draftData: ImportDraftData;
  createdAt: Date;
  updatedAt: Date;
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
