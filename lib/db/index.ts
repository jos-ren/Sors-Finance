/**
 * Database Module
 *
 * Central export for database types.
 * NOTE: All database operations now go through API routes.
 * Use @/hooks for data access in components.
 * Use @/lib/db/client for direct API calls.
 */

// Types only - safe for client components
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
} from "./types";

export { SYSTEM_CATEGORIES, BUCKET_TYPES } from "./types";
