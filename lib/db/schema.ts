/**
 * Drizzle Database Schema
 *
 * SQLite schema definitions matching the existing Dexie structure.
 */

import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

// ============================================
// Users Table
// ============================================

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uuid: text("uuid").notNull().unique(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("users_username_idx").on(table.username)]
);

// ============================================
// Sessions Table
// ============================================

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    token: text("token").notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("sessions_token_idx").on(table.token),
    index("sessions_user_idx").on(table.userId),
  ]
);

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
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("categories_order_idx").on(table.order),
    index("categories_name_idx").on(table.name),
    index("categories_user_idx").on(table.userId),
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
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("transactions_date_idx").on(table.date),
    index("transactions_category_idx").on(table.categoryId),
    index("transactions_source_idx").on(table.source),
    index("transactions_import_idx").on(table.importId),
    index("transactions_date_category_idx").on(table.date, table.categoryId),
    index("transactions_user_idx").on(table.userId),
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
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("budgets_year_month_idx").on(table.year, table.month),
    index("budgets_year_month_category_idx").on(table.year, table.month, table.categoryId),
    index("budgets_user_idx").on(table.userId),
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
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    importedAt: integer("imported_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("imports_source_idx").on(table.source),
    index("imports_user_idx").on(table.userId),
  ]
);

// ============================================
// Settings Table
// ============================================

export const settings = sqliteTable(
  "settings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("settings_user_idx").on(table.userId),
    index("settings_user_key_idx").on(table.userId, table.key),
  ]
);

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
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("portfolio_accounts_bucket_idx").on(table.bucket),
    index("portfolio_accounts_order_idx").on(table.order),
    index("portfolio_accounts_user_idx").on(table.userId),
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
    plaidAccountId: integer("plaid_account_id").references(() => plaidAccounts.id, { onDelete: "set null" }), // Link to Plaid account for syncing
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("portfolio_items_account_idx").on(table.accountId),
    index("portfolio_items_active_idx").on(table.isActive),
    index("portfolio_items_order_idx").on(table.order),
    index("portfolio_items_user_idx").on(table.userId),
    index("portfolio_items_plaid_idx").on(table.plaidAccountId),
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
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("portfolio_snapshots_date_idx").on(table.date),
    index("portfolio_snapshots_user_idx").on(table.userId),
  ]
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;

// ============================================
// Plaid Items Table
// ============================================

export const plaidItems = sqliteTable(
  "plaid_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uuid: text("uuid").notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    accessToken: text("access_token").notNull(), // Encrypted
    institutionId: text("institution_id").notNull(),
    institutionName: text("institution_name").notNull(),
    environment: text("environment").notNull().default("sandbox"), // 'sandbox' | 'development' | 'production'
    status: text("status").notNull().default("active"), // 'active' | 'login_required' | 'error'
    lastSync: integer("last_sync", { mode: "timestamp" }),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("plaid_items_user_idx").on(table.userId),
    index("plaid_items_item_idx").on(table.itemId),
    index("plaid_items_status_idx").on(table.status),
  ]
);

// ============================================
// Plaid Accounts Table
// ============================================

export const plaidAccounts = sqliteTable(
  "plaid_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uuid: text("uuid").notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plaidItemId: integer("plaid_item_id")
      .notNull()
      .references(() => plaidItems.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(), // Plaid's account_id
    name: text("name").notNull(),
    officialName: text("official_name"),
    type: text("type").notNull(), // 'depository', 'credit', 'investment', 'loan'
    subtype: text("subtype").notNull(), // 'checking', 'savings', 'credit card', etc.
    mask: text("mask"), // Last 4 digits
    portfolioAccountId: integer("portfolio_account_id").references(
      () => portfolioAccounts.id,
      { onDelete: "set null" }
    ),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("plaid_accounts_user_idx").on(table.userId),
    index("plaid_accounts_item_idx").on(table.plaidItemId),
    index("plaid_accounts_account_idx").on(table.accountId),
    index("plaid_accounts_portfolio_idx").on(table.portfolioAccountId),
  ]
);

export type PlaidItemRow = typeof plaidItems.$inferSelect;
export type PlaidItemInsert = typeof plaidItems.$inferInsert;

export type PlaidAccountRow = typeof plaidAccounts.$inferSelect;
export type PlaidAccountInsert = typeof plaidAccounts.$inferInsert;
