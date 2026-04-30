/**
 * Formatting Utilities
 *
 * Centralized formatting functions for currency, dates, numbers, and percentages.
 * Import from '@/lib/utils/formatters' to use.
 */

import { DEFAULT_CURRENCY, DEFAULT_LOCALE, MONTH_NAMES_SHORT } from "@/lib/constants";

// ============================================
// Currency Formatting
// ============================================

/**
 * Format a number as currency
 *
 * @param amount - The amount to format
 * @param currency - Currency code (default: CAD)
 * @param options - Additional Intl.NumberFormat options
 * @returns Formatted currency string with code
 *
 * @example
 * formatCurrency(1234.56, "CAD") // "$1,234.56 CAD"
 * formatCurrency(-500, "USD") // "-$500.00 USD"
 * formatCurrency(1000000, "EUR") // "€1,000,000.00 EUR"
 */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  options?: Partial<Intl.NumberFormatOptions>
): string {
  const formatted = new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency,
    currencyDisplay: "symbol", // Use simple symbol ($) not complex (US$)
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
  return `${formatted} ${currency}`;
}

/**
 * Format a number as currency without the currency code suffix
 * Used for compact displays where space is limited
 *
 * @param amount - The amount to format
 * @param currency - Currency code (default: CAD)
 * @returns Formatted currency string without code
 *
 * @example
 * formatCurrencyShort(1234.56, "CAD") // "$1,234.56"
 * formatCurrencyShort(-500, "USD") // "-$500.00"
 */
export function formatCurrencyShort(
  amount: number,
  currency: string = DEFAULT_CURRENCY
): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency,
    currencyDisplay: "symbol", // Use simple symbol ($) not complex (US$)
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format currency with sign (always show + or -)
 *
 * @param amount - The amount to format
 * @param currency - Currency code (default: CAD)
 * @returns Formatted currency string with sign
 *
 * @example
 * formatCurrencyWithSign(100, "CAD") // "+$100.00 CAD"
 * formatCurrencyWithSign(-50, "USD") // "-$50.00 USD"
 */
export function formatCurrencyWithSign(
  amount: number,
  currency: string = DEFAULT_CURRENCY
): string {
  const formatted = new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency,
    currencyDisplay: "symbol", // Use simple symbol ($) not complex (US$)
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}${formatted} ${currency}`;
}

/**
 * Format currency in compact notation for large amounts
 *
 * @param amount - The amount to format
 * @param currency - Currency code (default: CAD)
 * @returns Compact formatted currency string
 *
 * @example
 * formatCurrencyCompact(1000, "CAD") // "$1K CAD"
 * formatCurrencyCompact(1500000, "USD") // "$1.5M USD"
 */
export function formatCurrencyCompact(
  amount: number,
  currency: string = DEFAULT_CURRENCY
): string {
  const formatted = new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency,
    currencyDisplay: "symbol", // Use simple symbol ($) not complex (US$)
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
  return `${formatted} ${currency}`;
}

// ============================================
// Number Formatting
// ============================================

/**
 * Format a number with thousand separators
 *
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string
 *
 * @example
 * formatNumber(1234567) // "1,234,567"
 * formatNumber(1234.5678, 2) // "1,234.57"
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a number in compact notation
 *
 * @param value - The number to format
 * @returns Compact formatted string
 *
 * @example
 * formatCompact(1000) // "1K"
 * formatCompact(1500000) // "1.5M"
 */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

// ============================================
// Percentage Formatting
// ============================================

/**
 * Format a decimal as a percentage
 *
 * @param value - The decimal value (0.5 = 50%)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 *
 * @example
 * formatPercent(0.1234) // "12.3%"
 * formatPercent(0.5, 0) // "50%"
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format percentage with sign
 *
 * @param value - The decimal value
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage with + or - sign
 *
 * @example
 * formatPercentWithSign(0.05) // "+5.0%"
 * formatPercentWithSign(-0.1) // "-10.0%"
 */
export function formatPercentWithSign(value: number, decimals: number = 1): string {
  const formatted = formatPercent(Math.abs(value), decimals);
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

// ============================================
// Date Formatting
// ============================================

/**
 * Format a date for display
 *
 * @param date - Date to format
 * @param format - Format type
 * @returns Formatted date string
 *
 * @example
 * formatDate(new Date(2025, 11, 25)) // "Dec 25, 2025"
 * formatDate(new Date(2025, 11, 25), "short") // "12/25/25"
 */
export function formatDate(
  date: Date,
  format: "display" | "short" | "full" | "monthYear" | "iso" = "display",
  timezone?: string
): string {
  const tz = timezone ? { timeZone: timezone } : {};
  switch (format) {
    case "iso":
      return date.toISOString().split("T")[0];
    case "short":
      return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
        month: "2-digit",
        day: "2-digit",
        year: "2-digit",
        ...tz,
      }).format(date);
    case "full":
      return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
        month: "long",
        day: "numeric",
        year: "numeric",
        ...tz,
      }).format(date);
    case "monthYear":
      return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
        month: "short",
        year: "numeric",
        ...tz,
      }).format(date);
    case "display":
    default:
      return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
        month: "short",
        day: "numeric",
        year: "numeric",
        ...tz,
      }).format(date);
  }
}

/**
 * Format a date with time for display (e.g., "3/14/2026, 11:21:51 AM")
 *
 * @param date - Date to format
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Formatted date+time string
 */
export function formatDateTime(date: Date, timezone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(date);
}

/**
 * Format a date relative to now (e.g., "2 days ago")
 *
 * @param date - Date to format
 * @returns Relative time string
 *
 * @example
 * formatRelativeDate(yesterday) // "1 day ago"
 * formatRelativeDate(lastWeek) // "7 days ago"
 */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? "" : "s"} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) === 1 ? "" : "s"} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) === 1 ? "" : "s"} ago`;
}

/**
 * Get month name from month index (0-11)
 *
 * @param month - Month index (0 = January)
 * @param short - Use short name (default: false)
 * @returns Month name
 *
 * @example
 * getMonthName(0) // "January"
 * getMonthName(11, true) // "Dec"
 */
export function getMonthName(month: number, short: boolean = false): string {
  const names = short ? MONTH_NAMES_SHORT : [
    "January", "February", "March", "April",
    "May", "June", "July", "August",
    "September", "October", "November", "December",
  ];
  return names[month] || "";
}

// ============================================
// File Size Formatting
// ============================================

/**
 * Format bytes as human-readable file size
 *
 * @param bytes - Number of bytes
 * @returns Formatted file size string
 *
 * @example
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(1536) // "1.5 KB"
 * formatFileSize(1048576) // "1 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ============================================
// Privacy/Masking
// ============================================

/**
 * Mask a currency amount for privacy mode
 *
 * @param amount - The amount (used to determine if positive/negative)
 * @param showSign - Whether to show the sign
 * @returns Masked amount string
 *
 * @example
 * maskCurrency(1234.56) // "••••••"
 * maskCurrency(-500, true) // "-••••••"
 */
export function maskCurrency(amount: number, showSign: boolean = false): string {
  const mask = "••••••";
  if (!showSign) return mask;
  return amount >= 0 ? mask : `-${mask}`;
}

/**
 * Mask a percentage for privacy mode
 *
 * @returns Masked percentage string
 */
export function maskPercent(): string {
  return "••%";
}
