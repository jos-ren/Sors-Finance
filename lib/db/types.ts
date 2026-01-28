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
  categoryId: number | null;
  importId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Budget Types
// ============================================

export interface DbBudget {
  id?: number;
  categoryId: number;
  year: number;
  month: number | null;
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

export type RecategorizeMode = "uncategorized" | "all";

export interface RecategorizeResult {
  processed: number;
  updated: number;
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
  isInternational?: boolean;
}
