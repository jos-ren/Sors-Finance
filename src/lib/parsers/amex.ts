import * as XLSX from "xlsx";
import { Transaction, ParseResult } from "../types";

/**
 * Parse AMEX Excel file
 * Format:
 * - Excel only (.xlsx)
 * - Data starts at row 12 (rows 1-11 are skipped, row 12 contains headers)
 * - Column A: Date (DD Mon. YYYY format, e.g., "16 Dec. 2025")
 * - Column B: Date Processed
 * - Column C: Description
 * - Column D: Amount (with $ sign, positive = out, negative = in)
 * - Column J (index 9): Additional Information (for keyword matching)
 */
export async function parseAMEX(file: File): Promise<ParseResult> {
  const errors: string[] = [];
  const transactions: Transaction[] = [];

  try {
    // Parse Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to array of arrays
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    // Validate that we have enough rows (at least row 12)
    if (rows.length < 12) {
      errors.push("File does not contain enough rows (expected data at row 12)");
      return { transactions, errors };
    }

    // Row 12 (index 11) should be the header row
    // Data starts at row 13 (index 12)
    const dataRows = rows.slice(12); // Skip first 12 rows (0-11 are headers/metadata)

    if (dataRows.length === 0) {
      errors.push("No transaction data found after row 12");
      return { transactions, errors };
    }

    // Parse each data row
    dataRows.forEach((row, index) => {
      try {
        // Skip empty rows
        if (!row || row.length === 0) {
          return;
        }

        const dateStr = row[0]?.toString().trim();

        // Check if this is a payment row (amount in column C, column D empty)
        const columnD = row[3]?.toString().trim();
        const isPaymentRow = !columnD || columnD === "";

        let description: string;
        let amountStr: string;
        let matchField: string;

        if (isPaymentRow) {
          // Payment format: Amount (negative) in column C, description in column I
          amountStr = row[2]?.toString().trim() || "0"; // Column C
          description = row[8]?.toString().trim() || ""; // Column I (index 8)
          matchField = description;
        } else {
          // Regular expense format: Description in column C, amount in column D, additional info in column J
          description = row[2]?.toString().trim() || ""; // Column C
          amountStr = row[3]?.toString().trim() || "0"; // Column D
          const additionalInfo = row[9]?.toString().trim() || ""; // Column J (index 9)
          matchField = additionalInfo || description;
        }

        if (!dateStr || !matchField) {
          errors.push(
            `Row ${index + 13}: Missing date or match information`
          );
          return;
        }

        // Parse date (DD Mon. YYYY format)
        const date = parseAMEXDate(dateStr);
        if (!date || isNaN(date.getTime())) {
          errors.push(`Row ${index + 13}: Invalid date format "${dateStr}"`);
          return;
        }

        // Parse amount
        // Remove $ sign and parse as float
        // Positive = Money OUT (expense)
        // Negative = Money IN (payment/refund)
        const cleanAmount = amountStr.replace(/[$,]/g, "");
        const amount = parseFloat(cleanAmount);

        if (isNaN(amount)) {
          errors.push(`Row ${index + 13}: Invalid amount "${amountStr}"`);
          return;
        }

        const transaction: Transaction = {
          id: crypto.randomUUID(),
          date,
          description,
          matchField, // Use Additional Information for keyword matching
          amountOut: amount > 0 ? amount : 0, // Positive amount = expense
          amountIn: amount < 0 ? Math.abs(amount) : 0, // Negative amount = payment
          netAmount: amount < 0 ? Math.abs(amount) : -amount, // Net is reversed for AMEX
          source: "AMEX",
          categoryId: null,
          isConflict: false,
        };

        transactions.push(transaction);
      } catch (error) {
        errors.push(
          `Row ${index + 13}: ${error instanceof Error ? error.message : "Unknown error"}`
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
 * Parse AMEX date format (DD Mon. YYYY)
 * Examples: "16 Dec. 2025", "29 Nov. 2025"
 */
function parseAMEXDate(dateStr: string): Date | null {
  try {
    // Month abbreviations mapping
    const months: { [key: string]: number } = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };

    // Remove periods and split by spaces
    const cleaned = dateStr.replace(/\./g, "").toLowerCase();
    const parts = cleaned.split(/\s+/);

    if (parts.length !== 3) {
      return null;
    }

    const day = parseInt(parts[0], 10);
    const monthStr = parts[1].substring(0, 3); // Take first 3 letters
    const year = parseInt(parts[2], 10);

    const month = months[monthStr];

    if (
      isNaN(day) ||
      isNaN(year) ||
      month === undefined ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }

    return new Date(year, month, day);
  } catch {
    return null;
  }
}
