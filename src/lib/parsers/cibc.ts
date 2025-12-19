import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Transaction, ParseResult } from "../types";

/**
 * Parse CIBC CSV or Excel file
 * Format:
 * - No headers, data starts at row 1
 * - Column A (0): Date (MM/DD/YYYY)
 * - Column B (1): Name/Details (for keyword matching)
 * - Column C (2): Money Out (debit)
 * - Column D (3): Money In (credit)
 */
export async function parseCIBC(file: File): Promise<ParseResult> {
  const errors: string[] = [];
  const transactions: Transaction[] = [];

  try {
    const isExcel =
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls") ||
      file.name.endsWith(".xlsm");

    let rows: any[][] = [];

    if (isExcel) {
      // Parse Excel file
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    } else {
      // Parse CSV file
      const text = await file.text();
      const result = Papa.parse(text, {
        skipEmptyLines: true,
      });

      if (result.errors.length > 0) {
        result.errors.forEach((err) => {
          errors.push(`CSV parsing error: ${err.message}`);
        });
      }

      rows = result.data as any[][];
    }

    // Validate that we have data
    if (rows.length === 0) {
      errors.push("File is empty");
      return { transactions, errors };
    }

    // Parse each row
    rows.forEach((row, index) => {
      try {
        // Skip empty rows
        if (!row || row.length < 4) {
          return;
        }

        const dateStr = row[0]?.toString().trim();
        const description = row[1]?.toString().trim() || "";
        const moneyOutStr = row[2]?.toString().trim() || "0";
        const moneyInStr = row[3]?.toString().trim() || "0";

        if (!dateStr || !description) {
          errors.push(`Row ${index + 1}: Missing date or description`);
          return;
        }

        // Parse date (MM/DD/YYYY format)
        const date = parseCIBCDate(dateStr);
        if (!date || isNaN(date.getTime())) {
          errors.push(`Row ${index + 1}: Invalid date format "${dateStr}"`);
          return;
        }

        // Parse amounts (handle empty strings and various number formats)
        const moneyOut = parseFloat(moneyOutStr.replace(/[^0-9.-]/g, "")) || 0;
        const moneyIn = parseFloat(moneyInStr.replace(/[^0-9.-]/g, "")) || 0;

        const transaction: Transaction = {
          id: crypto.randomUUID(),
          date,
          description,
          matchField: description, // Use description for keyword matching
          amountOut: Math.abs(moneyOut),
          amountIn: Math.abs(moneyIn),
          netAmount: moneyIn - moneyOut,
          source: "CIBC",
          categoryId: null,
          isConflict: false,
        };

        transactions.push(transaction);
      } catch (error) {
        errors.push(
          `Row ${index + 1}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    });

    if (transactions.length === 0 && errors.length === 0) {
      errors.push("No valid transactions found in file");
    }
  } catch (error) {
    errors.push(
      `File parsing error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return { transactions, errors };
}

/**
 * Parse CIBC date format (MM/DD/YYYY or YYYY-MM-DD)
 */
function parseCIBCDate(dateStr: string): Date | null {
  try {
    // Handle YYYY-MM-DD format (ISO)
    if (dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);

        if (
          !isNaN(year) &&
          !isNaN(month) &&
          !isNaN(day) &&
          month >= 1 &&
          month <= 12 &&
          day >= 1 &&
          day <= 31
        ) {
          return new Date(year, month - 1, day);
        }
      }
    }

    // Handle MM/DD/YYYY format
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        const month = parseInt(parts[0], 10);
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);

        if (
          !isNaN(month) &&
          !isNaN(day) &&
          !isNaN(year) &&
          month >= 1 &&
          month <= 12 &&
          day >= 1 &&
          day <= 31
        ) {
          return new Date(year, month - 1, day);
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}
