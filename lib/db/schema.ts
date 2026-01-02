/**
 * Drizzle Database Schema
 *
 * SQLite schema definitions matching the existing Dexie structure.
 */

import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

// ============================================
// Categories Table
// ============================================

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uuid: text("uuid").notNull().unique(),
    name: text("name").notNull(),
    keywords: text("keywords", { mode: "json" }).$type<string[]>().notNull().default([]),
    order: integer("order").notNull().default(0),
    isSystem: integer("is_system", { mode: "boolean" }).default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("categories_order_idx").on(table.order),
    index("categories_name_idx").on(table.name),
  ]
);

// ============================================
// Transactions Table
// ============================================

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uuid: text("uuid").notNull().unique(),
    date: integer("date", { mode: "timestamp" }).notNull(),
    description: text("description").notNull(),
    matchField: text("match_field").notNull(),
    amountOut: real("amount_out").notNull().default(0),
    amountIn: real("amount_in").notNull().default(0),
    netAmount: real("net_amount").notNull().default(0),
    source: text("source").notNull(),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    importId: integer("import_id").references(() => imports.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("transactions_date_idx").on(table.date),
    index("transactions_category_idx").on(table.categoryId),
    index("transactions_source_idx").on(table.source),
    index("transactions_import_idx").on(table.importId),
    index("transactions_date_category_idx").on(table.date, table.categoryId),
  ]
);

// ============================================
// Budgets Table
// ============================================

export const budgets = sqliteTable(
  "budgets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month"), // null for yearly budgets
    amount: real("amount").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("budgets_year_month_idx").on(table.year, table.month),
    index("budgets_year_month_category_idx").on(table.year, table.month, table.categoryId),
  ]
);

// ============================================
// Imports Table
// ============================================

export const imports = sqliteTable(
  "imports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fileName: text("file_name").notNull(),
    source: text("source").notNull(),
    transactionCount: integer("transaction_count").notNull(),
    totalAmount: real("total_amount").notNull(),
    importedAt: integer("imported_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("imports_source_idx").on(table.source)]
);

// ============================================
// Settings Table
// ============================================

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

// ============================================
// Portfolio Accounts Table
// ============================================

export const portfolioAccounts = sqliteTable(
  "portfolio_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uuid: text("uuid").notNull().unique(),
    bucket: text("bucket").notNull(), // 'Savings' | 'Investments' | 'Assets' | 'Debt'
    name: text("name").notNull(),
    order: integer("order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("portfolio_accounts_bucket_idx").on(table.bucket),
    index("portfolio_accounts_order_idx").on(table.order),
  ]
);

// ============================================
// Portfolio Items Table
// ============================================

export const portfolioItems = sqliteTable(
  "portfolio_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uuid: text("uuid").notNull().unique(),
    accountId: integer("account_id")
      .notNull()
      .references(() => portfolioAccounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    currentValue: real("current_value").notNull().default(0),
    notes: text("notes"),
    order: integer("order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ticker: text("ticker"),
    quantity: real("quantity"),
    pricePerUnit: real("price_per_unit"),
    currency: text("currency"),
    lastPriceUpdate: integer("last_price_update", { mode: "timestamp" }),
    priceMode: text("price_mode"), // 'manual' | 'ticker'
    isInternational: integer("is_international", { mode: "boolean" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("portfolio_items_account_idx").on(table.accountId),
    index("portfolio_items_active_idx").on(table.isActive),
    index("portfolio_items_order_idx").on(table.order),
  ]
);

// ============================================
// Portfolio Snapshots Table
// ============================================

export interface SnapshotDetails {
  accounts: Array<{ id: number; bucket: string; name: string; total: number }>;
  items: Array<{ id: number; accountId: number; name: string; value: number }>;
}

export const portfolioSnapshots = sqliteTable(
  "portfolio_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uuid: text("uuid").notNull().unique(),
    date: integer("date", { mode: "timestamp" }).notNull(),
    totalSavings: real("total_savings").notNull().default(0),
    totalInvestments: real("total_investments").notNull().default(0),
    totalAssets: real("total_assets").notNull().default(0),
    totalDebt: real("total_debt").notNull().default(0),
    netWorth: real("net_worth").notNull().default(0),
    details: text("details", { mode: "json" }).$type<SnapshotDetails>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("portfolio_snapshots_date_idx").on(table.date)]
);

// ============================================
// Type Exports for Schema
// ============================================

export type CategoryRow = typeof categories.$inferSelect;
export type CategoryInsert = typeof categories.$inferInsert;

export type TransactionRow = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;

export type BudgetRow = typeof budgets.$inferSelect;
export type BudgetInsert = typeof budgets.$inferInsert;

export type ImportRow = typeof imports.$inferSelect;
export type ImportInsert = typeof imports.$inferInsert;

export type SettingsRow = typeof settings.$inferSelect;
export type SettingsInsert = typeof settings.$inferInsert;

export type PortfolioAccountRow = typeof portfolioAccounts.$inferSelect;
export type PortfolioAccountInsert = typeof portfolioAccounts.$inferInsert;

export type PortfolioItemRow = typeof portfolioItems.$inferSelect;
export type PortfolioItemInsert = typeof portfolioItems.$inferInsert;

export type PortfolioSnapshotRow = typeof portfolioSnapshots.$inferSelect;
export type PortfolioSnapshotInsert = typeof portfolioSnapshots.$inferInsert;
