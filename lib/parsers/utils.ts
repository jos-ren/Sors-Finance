/**
 * Bank Parser Utilities
 *
 * Shared utilities for parsing bank files. Use these helpers to avoid
 * duplicating common parsing logic across bank parsers.
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";

/**
 * Month name to number mapping (0-indexed)
 */
const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Check if a file is an Excel file based on extension
 */
export function isExcelFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm");
}

/**
 * Check if a file is a CSV file based on extension
 */
export function isCsvFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".csv");
}

/**
 * Read a file and convert to rows (array of arrays)
 * Handles both CSV and Excel formats
 */
export async function readFileToRows(file: File): Promise<unknown[][]> {
  if (isExcelFile(file.name)) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
  }

  if (isCsvFile(file.name)) {
    const text = await file.text();
    const result = Papa.parse(text, { skipEmptyLines: true });
    return result.data as unknown[][];
  }

  throw new Error(`Unsupported file format: ${file.name}`);
}

/**
 * Parse a date in MM/DD/YYYY format
 * @returns Date object or null if parsing fails
 */
export function parseDateMDY(dateStr: string): Date | null {
  if (!dateStr) return null;

  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return new Date(year, month - 1, day);
}

/**
 * Parse a date in DD/MM/YYYY format
 * @returns Date object or null if parsing fails
 */
export function parseDateDMY(dateStr: string): Date | null {
  if (!dateStr) return null;

  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return new Date(year, month - 1, day);
}

/**
 * Parse a date in YYYY-MM-DD format (ISO)
 * @returns Date object or null if parsing fails
 */
export function parseDateISO(dateStr: string): Date | null {
  if (!dateStr) return null;

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return new Date(year, month - 1, day);
}

/**
 * Parse a date in "DD Mon YYYY" or "DD Mon. YYYY" format
 * Examples: "16 Dec 2025", "16 Dec. 2025", "1 January 2025"
 * @returns Date object or null if parsing fails
 */
export function parseDateDMonY(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Remove periods and normalize whitespace
  const cleaned = dateStr.replace(/\./g, "").trim().toLowerCase();
  const parts = cleaned.split(/\s+/);

  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const monthStr = parts[1].substring(0, 3);
  const year = parseInt(parts[2], 10);

  const month = MONTH_MAP[monthStr];

  if (isNaN(day) || isNaN(year) || month === undefined || day < 1 || day > 31) {
    return null;
  }

  return new Date(year, month, day);
}

/**
 * Parse a date in "Mon DD, YYYY" format
 * Examples: "Dec 16, 2025", "January 1, 2025"
 * @returns Date object or null if parsing fails
 */
export function parseDateMonDY(dateStr: string): Date | null {
  if (!dateStr) return null;

  const cleaned = dateStr.replace(/,/g, "").trim().toLowerCase();
  const parts = cleaned.split(/\s+/);

  if (parts.length !== 3) return null;

  const monthStr = parts[0].substring(0, 3);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  const month = MONTH_MAP[monthStr];

  if (isNaN(day) || isNaN(year) || month === undefined || day < 1 || day > 31) {
    return null;
  }

  return new Date(year, month, day);
}

/**
 * Clean and parse an amount string to a number
 * Handles currency symbols, commas, and various formats
 * @returns Parsed number or 0 if parsing fails
 */
export function parseAmount(amountStr: string | null | undefined): number {
  if (!amountStr) return 0;

  // Remove currency symbols, spaces, and keep only digits, dots, minus, and commas
  const cleaned = amountStr.toString().replace(/[^0-9.,\-]/g, "");

  // Handle European format (1.234,56) vs US format (1,234.56)
  // If there's a comma after the last dot, it's European format
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  let normalized: string;
  if (lastComma > lastDot) {
    // European format: 1.234,56 -> 1234.56
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // US format: 1,234.56 -> 1234.56
    normalized = cleaned.replace(/,/g, "");
  }

  const result = parseFloat(normalized);
  return isNaN(result) ? 0 : result;
}

/**
 * Safely get a cell value as a trimmed string
 */
export function getCellString(row: unknown[], index: number): string {
  const value = row[index];
  if (value === null || value === undefined) return "";
  return value.toString().trim();
}

/**
 * Check if a row is empty (all cells are empty or whitespace)
 */
export function isEmptyRow(row: unknown[]): boolean {
  if (!row || !Array.isArray(row) || row.length === 0) return true;
  return row.every(cell => {
    if (cell === null || cell === undefined) return true;
    const str = cell.toString().trim();
    return str === "";
  });
}

/**
 * Create regex patterns for detecting bank-specific content
 */
export function createPatternMatcher(patterns: RegExp[]): (text: string) => boolean {
  return (text: string) => patterns.some(pattern => pattern.test(text));
}

/**
 * Normalize a Date to YYYY-MM-DD format using local timezone
 * This ensures consistent date comparison regardless of timezone or time component
 *
 * IMPORTANT: Use this for all duplicate detection and date comparison logic
 * to avoid timezone-related issues where dates can shift by a day.
 *
 * @param date - Date object to normalize
 * @returns Date string in YYYY-MM-DD format using local date values
 *
 * @example
 * const date = new Date(2024, 0, 15); // Jan 15, 2024
 * normalizeDate(date); // "2024-01-15" (always, regardless of timezone)
 */
export function normalizeDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
