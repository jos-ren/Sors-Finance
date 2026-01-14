/**
 * Column Detection Utilities
 *
 * Auto-detects likely column mappings for custom imports by analyzing:
 * - Header text (if present)
 * - Data patterns (dates, amounts, text)
 * - Column content characteristics
 */

import type { ColumnDetectionResult, DetectedColumn } from "./types";
import { getCellString, parseDateMDY, parseDateDMY, parseDateISO, parseDateDMonY, parseDateMonDY, parseAmount } from "./utils";

/**
 * Detect if first row contains headers by analyzing text patterns
 */
export function detectHeaders(rows: unknown[][]): boolean {
  if (rows.length < 2) return false;

  const firstRow = rows[0];
  const secondRow = rows[1];

  if (!firstRow || !secondRow) return false;

  let headerIndicators = 0;
  let dataIndicators = 0;

  // Check each column
  for (let col = 0; col < Math.min(firstRow.length, secondRow.length); col++) {
    const cell1 = getCellString(firstRow, col).toLowerCase();
    const cell2 = getCellString(secondRow, col);

    // Common header keywords
    const headerKeywords = [
      "date",
      "time",
      "desc",
      "description",
      "amount",
      "credit",
      "debit",
      "balance",
      "transaction",
      "memo",
      "category",
      "name",
      "type",
      "reference",
      "payee",
    ];

    if (headerKeywords.some((keyword) => cell1.includes(keyword))) {
      headerIndicators++;
    }

    // Check if second row looks like data (has numbers, dates)
    if (cell2) {
      if (isLikelyDate(cell2) || isLikelyAmount(cell2)) {
        dataIndicators++;
      }
    }

    // First row shouldn't have dates/amounts if it's a header
    if (cell1 && (isLikelyDate(cell1) || isLikelyAmount(cell1))) {
      headerIndicators--;
    }
  }

  return headerIndicators > dataIndicators;
}

/**
 * Check if a string looks like a date
 */
function isLikelyDate(str: string): boolean {
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // ISO: 2024-01-15
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/, // MDY or DMY: 01/15/2024
    /^\d{1,2}\s+[A-Za-z]{3}\.?\s+\d{4}$/, // DMonY: 15 Jan 2024
    /^[A-Za-z]{3}\.?\s+\d{1,2},?\s+\d{4}$/, // MonDY: Jan 15, 2024
  ];

  return datePatterns.some((pattern) => pattern.test(str));
}

/**
 * Check if a string looks like an amount
 */
function isLikelyAmount(str: string): boolean {
  // Remove common currency symbols and whitespace
  const cleaned = str.replace(/[$€£¥₹\s]/g, "");

  // Check if it matches number patterns
  return /^-?[\d,]+\.?\d*$/.test(cleaned) || /^-?[\d.]+,?\d*$/.test(cleaned);
}

/**
 * Detect the date format from sample data
 */
function detectDateFormat(samples: string[]): string | undefined {
  const formats = [
    { name: "ISO", parser: parseDateISO },
    { name: "MDY", parser: parseDateMDY },
    { name: "DMY", parser: parseDateDMY },
    { name: "DMonY", parser: parseDateDMonY },
    { name: "MonDY", parser: parseDateMonDY },
  ];

  for (const format of formats) {
    let successCount = 0;
    for (const sample of samples) {
      const date = format.parser(sample);
      if (date && !isNaN(date.getTime())) {
        successCount++;
      }
    }
    // If most samples parse successfully, this is likely the format
    if (successCount >= samples.length * 0.8) {
      return format.name;
    }
  }

  return undefined;
}

/**
 * Analyze a column to determine its likely purpose
 */
function analyzeColumn(
  columnIndex: number,
  rows: unknown[][],
  header?: string
): { type: "date" | "amount" | "text" | "unknown"; confidence: "high" | "medium" | "low"; samples: string[] } {
  const samples: string[] = [];
  let dateCount = 0;
  let amountCount = 0;
  let textCount = 0;
  let totalNonEmpty = 0;

  // Sample first 20 rows
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    const cell = getCellString(row, columnIndex);
    if (!cell) continue;

    totalNonEmpty++;
    samples.push(cell);

    if (isLikelyDate(cell)) dateCount++;
    else if (isLikelyAmount(cell)) amountCount++;
    else if (cell.length > 5) textCount++;
  }

  if (totalNonEmpty === 0) {
    return { type: "unknown", confidence: "low", samples: [] };
  }

  const dateRatio = dateCount / totalNonEmpty;
  const amountRatio = amountCount / totalNonEmpty;
  const textRatio = textCount / totalNonEmpty;

  // Determine type based on ratios
  if (dateRatio >= 0.8) {
    return { type: "date", confidence: "high", samples };
  } else if (dateRatio >= 0.5) {
    return { type: "date", confidence: "medium", samples };
  } else if (amountRatio >= 0.8) {
    return { type: "amount", confidence: "high", samples };
  } else if (amountRatio >= 0.5) {
    return { type: "amount", confidence: "medium", samples };
  } else if (textRatio >= 0.6) {
    return { type: "text", confidence: "high", samples };
  } else if (textRatio >= 0.3) {
    return { type: "text", confidence: "medium", samples };
  }

  return { type: "unknown", confidence: "low", samples };
}

/**
 * Check if header text suggests a specific field type
 */
function headerSuggestsType(header: string, targetType: "date" | "description" | "amountIn" | "amountOut"): boolean {
  const lower = header.toLowerCase();

  switch (targetType) {
    case "date":
      return /date|time|posted|transaction.*date/i.test(lower);

    case "description":
      return /desc|description|memo|detail|transaction|payee|merchant|name|particulars/i.test(lower);

    case "amountIn":
      return /credit|deposit|income|in|received|amount.*in|positive/i.test(lower) && !/out|debit|withdraw/i.test(lower);

    case "amountOut":
      return /debit|withdraw|payment|out|spent|amount.*out|negative/i.test(lower) && !/in|credit|deposit/i.test(lower);

    default:
      return false;
  }
}

/**
 * Auto-detect column mappings from file data
 */
export function detectColumns(rows: unknown[][]): ColumnDetectionResult {
  if (rows.length === 0) {
    return { hasHeaders: false, dateFormat: undefined };
  }

  const hasHeaders = detectHeaders(rows);
  const dataStartRow = hasHeaders ? 1 : 0;
  const dataRows = rows.slice(dataStartRow);
  const headerRow = hasHeaders ? rows[0] : undefined;

  if (dataRows.length === 0) {
    return { hasHeaders, dateFormat: undefined };
  }

  // Analyze each column
  const columnAnalysis = [];
  const maxCols = Math.max(...dataRows.map((row) => (Array.isArray(row) ? row.length : 0)));

  for (let col = 0; col < maxCols; col++) {
    const header = headerRow ? getCellString(headerRow, col) : undefined;
    const analysis = analyzeColumn(col, dataRows, header);
    columnAnalysis.push({ col, header, ...analysis });
  }

  // Detect date column
  let dateColumn: DetectedColumn | undefined;
  for (const col of columnAnalysis) {
    if (col.type === "date") {
      const headerMatch = col.header && headerSuggestsType(col.header, "date");
      dateColumn = {
        index: col.col,
        header: col.header,
        confidence: headerMatch ? "high" : col.confidence,
        reason: headerMatch ? `Header "${col.header}" suggests date` : "Column contains date-like values",
      };
      break;
    }
  }

  // Detect date format if we found a date column
  let dateFormat: string | undefined;
  if (dateColumn) {
    const analysis = columnAnalysis.find((c) => c.col === dateColumn!.index);
    dateFormat = analysis ? detectDateFormat(analysis.samples) : undefined;
  }

  // Detect description column (longest text column, usually first or second text column)
  let descriptionColumn: DetectedColumn | undefined;
  const textColumns = columnAnalysis.filter((c) => c.type === "text");
  for (const col of textColumns) {
    const headerMatch = col.header && headerSuggestsType(col.header, "description");
    if (headerMatch) {
      descriptionColumn = {
        index: col.col,
        header: col.header,
        confidence: "high",
        reason: `Header "${col.header}" suggests description`,
      };
      break;
    }
  }

  // If no header match, pick first text column with decent length
  if (!descriptionColumn && textColumns.length > 0) {
    const col = textColumns[0];
    descriptionColumn = {
      index: col.col,
      header: col.header,
      confidence: "medium",
      reason: "First text column - likely description",
    };
  }

  // Detect amount columns
  const amountColumns = columnAnalysis.filter((c) => c.type === "amount");

  let amountInColumn: DetectedColumn | undefined;
  let amountOutColumn: DetectedColumn | undefined;

  // Try to match by headers first
  for (const col of amountColumns) {
    if (col.header) {
      if (!amountInColumn && headerSuggestsType(col.header, "amountIn")) {
        amountInColumn = {
          index: col.col,
          header: col.header,
          confidence: "high",
          reason: `Header "${col.header}" suggests money in`,
        };
      }
      if (!amountOutColumn && headerSuggestsType(col.header, "amountOut")) {
        amountOutColumn = {
          index: col.col,
          header: col.header,
          confidence: "high",
          reason: `Header "${col.header}" suggests money out`,
        };
      }
    }
  }

  // Fallback: use first two amount columns
  if (!amountInColumn && !amountOutColumn && amountColumns.length > 0) {
    if (amountColumns.length === 1) {
      // Single amount column - likely combined in/out
      const col = amountColumns[0];
      amountInColumn = amountOutColumn = {
        index: col.col,
        header: col.header,
        confidence: "medium",
        reason: "Single amount column found - may contain both in/out",
      };
    } else {
      // Multiple amount columns - guess first two
      const col1 = amountColumns[0];
      const col2 = amountColumns[1];

      amountOutColumn = {
        index: col1.col,
        header: col1.header,
        confidence: "low",
        reason: "First amount column - guessing as money out",
      };

      amountInColumn = {
        index: col2.col,
        header: col2.header,
        confidence: "low",
        reason: "Second amount column - guessing as money in",
      };
    }
  }

  return {
    dateColumn,
    descriptionColumn,
    amountInColumn,
    amountOutColumn,
    hasHeaders,
    dateFormat,
  };
}
