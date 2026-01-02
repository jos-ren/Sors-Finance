/**
 * Application Constants
 *
 * Centralized constants for the Sors Finance application.
 * Import from '@/lib/constants' to use.
 */

// ============================================
// Portfolio Bucket Types
// ============================================

/**
 * The fixed bucket types for portfolio categorization
 */
export const BUCKET_TYPES = ["Savings", "Investments", "Assets", "Debt"] as const;
export type BucketType = (typeof BUCKET_TYPES)[number];

// ============================================
// System Categories
// ============================================

/**
 * System category names (cannot be deleted by users)
 */
export const SYSTEM_CATEGORIES = {
  EXCLUDED: "Excluded",
  UNCATEGORIZED: "Uncategorized",
  INCOME: "Income",
} as const;

// ============================================
// Local Storage Keys
// ============================================

/**
 * Keys used for localStorage persistence
 */
export const STORAGE_KEYS = {
  PRIVACY_MODE: "sors-privacy-mode",
  FINNHUB_API_KEY: "sors-finnhub-api-key",
  THEME: "theme",
} as const;

// ============================================
// Currency & Locale
// ============================================

/**
 * Default currency for the application
 */
export const DEFAULT_CURRENCY = "CAD";

/**
 * Default locale for formatting
 */
export const DEFAULT_LOCALE = "en-CA";

/**
 * Supported currencies with their symbols
 */
export const CURRENCIES = {
  CAD: { symbol: "$", name: "Canadian Dollar" },
  USD: { symbol: "$", name: "US Dollar" },
  EUR: { symbol: "€", name: "Euro" },
  GBP: { symbol: "£", name: "British Pound" },
} as const;

// ============================================
// Date Formats
// ============================================

/**
 * Date format patterns used in the application
 */
export const DATE_FORMATS = {
  /** Display format for dates (e.g., "Dec 25, 2025") */
  display: "MMM d, yyyy",
  /** ISO format (e.g., "2025-12-25") */
  iso: "yyyy-MM-dd",
  /** Short format (e.g., "12/25/25") */
  short: "MM/dd/yy",
  /** Full format (e.g., "December 25, 2025") */
  full: "MMMM d, yyyy",
  /** Month/Year only (e.g., "Dec 2025") */
  monthYear: "MMM yyyy",
} as const;

/**
 * Month names for display
 */
export const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
] as const;

/**
 * Short month names
 */
export const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

// ============================================
// API Configuration
// ============================================

/**
 * External API endpoints
 */
export const API_ENDPOINTS = {
  FINNHUB_QUOTE: "https://finnhub.io/api/v1/quote",
  FINNHUB_SEARCH: "https://finnhub.io/api/v1/search",
  COINGECKO_PRICE: "https://api.coingecko.com/api/v3/simple/price",
  COINGECKO_SEARCH: "https://api.coingecko.com/api/v3/search",
  EXCHANGE_RATE: "https://api.exchangerate-api.com/v4/latest",
} as const;

/**
 * Cache durations in milliseconds
 */
export const CACHE_DURATIONS = {
  /** Stock/crypto price cache: 5 minutes */
  PRICE: 5 * 60 * 1000,
  /** Exchange rate cache: 1 hour */
  EXCHANGE_RATE: 60 * 60 * 1000,
} as const;

// ============================================
// UI Configuration
// ============================================

/**
 * Chart color palette (lime theme)
 */
export const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

/**
 * Alternative colors for variety
 */
export const ALT_COLORS = {
  amber: "hsl(var(--alt-amber))",
  blue: "hsl(var(--alt-blue))",
  cyan: "hsl(var(--alt-cyan))",
  emerald: "hsl(var(--alt-emerald))",
  fuchsia: "hsl(var(--alt-fuchsia))",
  green: "hsl(var(--alt-green))",
  indigo: "hsl(var(--alt-indigo))",
  lime: "hsl(var(--alt-lime))",
  orange: "hsl(var(--alt-orange))",
  pink: "hsl(var(--alt-pink))",
  red: "hsl(var(--alt-red))",
} as const;

/**
 * Animation durations
 */
export const ANIMATION_DURATIONS = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

// ============================================
// Validation
// ============================================

/**
 * Maximum lengths for input validation
 */
export const MAX_LENGTHS = {
  categoryName: 50,
  keyword: 100,
  transactionDescription: 500,
  notes: 1000,
  accountName: 50,
  itemName: 100,
} as const;

/**
 * Regex patterns for validation
 */
export const VALIDATION_PATTERNS = {
  /** Stock ticker symbol (e.g., AAPL, BRK.A) */
  ticker: /^[A-Z]{1,5}(\.[A-Z])?$/,
  /** Crypto symbol (e.g., BTC, ETH) */
  cryptoSymbol: /^[A-Z]{2,10}$/,
} as const;
