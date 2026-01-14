/**
 * Custom Bank Parser
 *
 * Flexible parser for custom CSV/Excel imports with user-defined column mappings.
 * Unlike other parsers, this one is created via a factory function with a ColumnMapping config.
 *
 * Usage:
 *   const mapping: ColumnMapping = { dateColumn: 0, descriptionColumn: 1, ... };
 *   const parser = createCustomParser(mapping);
 *   const result = parser.parse(file, rows);
 */

import type {
  BankParser,
  BankDetectionResult,
  ValidationResult,
  ParseResult,
  ParsedTransaction,
  ColumnMapping,
} from "../types";
import {
  getCellString,
  parseAmount,
  parseDateMDY,
  parseDateDMY,
  parseDateISO,
  parseDateDMonY,
  parseDateMonDY,
  isEmptyRow,
} from "../utils";

/**
 * Try multiple date formats to parse a date string
 */
function parseFlexibleDate(dateStr: string, preferredFormat?: string): Date | null {
  if (!dateStr) return null;

  const formats = [
    { name: "ISO", parser: parseDateISO, pattern: /^\d{4}-\d{2}-\d{2}$/ },
    { name: "MDY", parser: parseDateMDY, pattern: /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/ },
    { name: "DMY", parser: parseDateDMY, pattern: /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/ },
    { name: "DMonY", parser: parseDateDMonY, pattern: /^\d{1,2}\s+[A-Za-z]{3}\.?\s+\d{4}$/ },
    { name: "MonDY", parser: parseDateMonDY, pattern: /^[A-Za-z]{3}\.?\s+\d{1,2},?\s+\d{4}$/ },
  ];

  // Try preferred format first if specified
  if (preferredFormat) {
    const preferred = formats.find((f) => f.name === preferredFormat);
    if (preferred && preferred.pattern.test(dateStr)) {
      const date = preferred.parser(dateStr);
      if (date && !isNaN(date.getTime())) return date;
    }
  }

  // Try all formats
  for (const format of formats) {
    if (format.pattern.test(dateStr)) {
      const date = format.parser(dateStr);
      if (date && !isNaN(date.getTime())) return date;
    }
  }

  return null;
}

/**
 * Create a custom parser with user-defined column mapping
 */
export function createCustomParser(mapping: ColumnMapping): BankParser {
  return {
    meta: {
      id: "CUSTOM",
      name: "Custom Import",
      country: "CUSTOM",
      supportedExtensions: [".csv", ".xlsx", ".xls"],
      formatDescription: "User-defined column mapping",
    },

    detect(file: File, rows: unknown[][]): BankDetectionResult {
      // Custom parser always returns low confidence
      // It acts as a fallback option when no other parser matches
      if (rows.length === 0) {
        return { detected: false, confidence: "none", reason: "File is empty" };
      }

      return {
        detected: true,
        confidence: "low",
        reason: "Use custom import for files that don't match any bank format",
      };
    },

    validate(file: File, rows: unknown[][]): ValidationResult {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (rows.length === 0) {
        errors.push("File is empty");
        return { isValid: false, errors, warnings };
      }

      // Determine starting row (skip headers if specified)
      const startRow = mapping.hasHeaders ? 1 : 0;
      const dataRows = rows.slice(startRow);

      if (dataRows.length === 0) {
        errors.push("No data rows found (file only contains headers)");
        return { isValid: false, errors, warnings };
      }

      // Check that all required columns exist
      const maxColumn = Math.max(
        mapping.dateColumn,
        mapping.descriptionColumn,
        mapping.amountInColumn,
        mapping.amountOutColumn,
        ...(mapping.matchFieldColumns || [])
      );

      let validRows = 0;
      let invalidDateRows = 0;
      let missingDescriptionRows = 0;
      let columnCountIssues = 0;

      // Validate first 10 data rows
      for (let i = 0; i < Math.min(dataRows.length, 10); i++) {
        const row = dataRows[i];
        if (!row || !Array.isArray(row)) continue;
        if (isEmptyRow(row)) continue;

        validRows++;

        // Check column count
        if (row.length <= maxColumn) {
          columnCountIssues++;
          continue;
        }

        // Validate date
        const dateStr = getCellString(row, mapping.dateColumn);
        if (!dateStr) {
          invalidDateRows++;
        } else {
          const date = parseFlexibleDate(dateStr, mapping.dateFormat);
          if (!date) {
            invalidDateRows++;
          }
        }

        // Validate description
        const description = getCellString(row, mapping.descriptionColumn);
        if (!description) {
          missingDescriptionRows++;
        }
      }

      if (validRows === 0) {
        errors.push("No valid data rows found");
        return { isValid: false, errors, warnings };
      }

      if (columnCountIssues > validRows / 2) {
        errors.push(
          `File has fewer columns than expected. Need at least ${maxColumn + 1} columns, but many rows have fewer.`
        );
      }

      if (invalidDateRows > validRows / 2) {
        errors.push(
          `Date column (${mapping.dateColumn + 1}) contains invalid dates. Check the date format or column selection.`
        );
      }

      if (missingDescriptionRows > validRows / 2) {
        warnings.push(`Description column (${mapping.descriptionColumn + 1}) is empty for many rows`);
      }

      return { isValid: errors.length === 0, errors, warnings };
    },

    parse(file: File, rows: unknown[][]): ParseResult {
      const transactions: ParsedTransaction[] = [];
      const errors: string[] = [];

      // Determine starting row (skip headers if specified)
      const startRow = mapping.hasHeaders ? 1 : 0;

      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;

        try {
          if (!row || !Array.isArray(row)) continue;
          if (isEmptyRow(row)) continue;

          // Extract values based on mapping
          const dateStr = getCellString(row, mapping.dateColumn);
          const description = getCellString(row, mapping.descriptionColumn);

          if (!dateStr || !description) {
            errors.push(`Row ${rowNum}: Missing date or description`);
            continue;
          }

          // Parse date
          const date = parseFlexibleDate(dateStr, mapping.dateFormat);
          if (!date || isNaN(date.getTime())) {
            errors.push(`Row ${rowNum}: Invalid date format "${dateStr}"`);
            continue;
          }

          // Parse amounts
          let amountIn = 0;
          let amountOut = 0;

          if (mapping.useNegativeForOut && mapping.amountInColumn === mapping.amountOutColumn) {
            // Both columns map to same index - use sign to determine in/out
            const amountStr = getCellString(row, mapping.amountInColumn);
            const amount = parseAmount(amountStr);

            if (amount >= 0) {
              amountIn = amount;
            } else {
              amountOut = Math.abs(amount);
            }
          } else {
            // Separate columns for in and out
            const amountInStr = getCellString(row, mapping.amountInColumn);
            const amountOutStr = getCellString(row, mapping.amountOutColumn);

            amountIn = Math.abs(parseAmount(amountInStr));
            amountOut = Math.abs(parseAmount(amountOutStr));
          }

          // Build match field
          let matchField = description;
          if (mapping.matchFieldColumns && mapping.matchFieldColumns.length > 0) {
            const matchParts = mapping.matchFieldColumns.map((colIndex) => getCellString(row, colIndex)).filter(Boolean);
            matchField = matchParts.join(" ");
          }

          transactions.push({
            date,
            description,
            matchField,
            amountOut,
            amountIn,
            netAmount: amountIn - amountOut,
          });
        } catch (error) {
          errors.push(`Row ${rowNum}: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }

      if (transactions.length === 0 && errors.length === 0) {
        errors.push("No valid transactions found in file");
      }

      return { transactions, errors };
    },
  };
}

/**
 * Default custom parser instance (for registration)
 * This is a placeholder that will be replaced with user-configured parser at runtime
 */
export const customParser: BankParser = {
  meta: {
    id: "CUSTOM",
    name: "Custom Import",
    country: "CUSTOM",
    supportedExtensions: [".csv", ".xlsx", ".xls"],
    formatDescription: "Flexible import with custom column mapping",
  },

  detect(file: File, rows: unknown[][]): BankDetectionResult {
    // Always returns low confidence as a fallback option
    if (rows.length === 0) {
      return { detected: false, confidence: "none", reason: "File is empty" };
    }

    return {
      detected: true,
      confidence: "low",
      reason: "Configure column mapping for custom import",
    };
  },

  validate(file: File, rows: unknown[][]): ValidationResult {
    // Placeholder - user must configure mapping first
    return {
      isValid: false,
      errors: ["Please configure column mapping before importing"],
      warnings: [],
    };
  },

  parse(file: File, rows: unknown[][]): ParseResult {
    // Placeholder - user must configure mapping first
    return {
      transactions: [],
      errors: ["Please configure column mapping before importing"],
    };
  },
};

export default customParser;
