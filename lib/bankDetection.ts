import Papa from "papaparse";
import * as XLSX from "xlsx";

export type BankType = "CIBC" | "AMEX" | "UNKNOWN";
export type DetectionConfidence = "high" | "medium" | "low" | "none";

export interface BankDetectionResult {
  bankType: BankType;
  confidence: DetectionConfidence;
  reason: string;
}

/**
 * Detect bank type from file contents by analyzing structure and data patterns
 */
export async function detectBankFromContents(file: File): Promise<BankDetectionResult> {
  try {
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".xlsm");

    let rows: unknown[][] = [];

    if (isExcel) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
    } else {
      // CSV file
      const text = await file.text();
      const result = Papa.parse(text, { skipEmptyLines: true });
      rows = result.data as unknown[][];
    }

    if (rows.length === 0) {
      return { bankType: "UNKNOWN", confidence: "none", reason: "File is empty" };
    }

    // Check for AMEX patterns
    const amexResult = checkForAMEX(rows);
    if (amexResult.confidence !== "none") {
      return amexResult;
    }

    // Check for CIBC patterns
    const cibcResult = checkForCIBC(rows);
    if (cibcResult.confidence !== "none") {
      return cibcResult;
    }

    return { bankType: "UNKNOWN", confidence: "none", reason: "Could not determine bank type from file contents" };
  } catch (error) {
    return {
      bankType: "UNKNOWN",
      confidence: "none",
      reason: `Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
}

/**
 * Check if file matches AMEX format
 * - Data starts at row 13 (index 12)
 * - Date format: DD Mon. YYYY (e.g., "16 Dec. 2025")
 * - Has $ signs in amount columns
 * - Has more than 4 columns
 */
function checkForAMEX(rows: unknown[][]): BankDetectionResult {
  // AMEX files have at least 12 header rows + 1 data row
  if (rows.length < 13) {
    return { bankType: "AMEX", confidence: "none", reason: "" };
  }

  // Check if row 13+ has data that matches AMEX pattern
  const dataRows = rows.slice(12);
  if (dataRows.length === 0) {
    return { bankType: "AMEX", confidence: "none", reason: "" };
  }

  let amexPatternMatches = 0;
  let totalDataRows = 0;

  for (const row of dataRows) {
    if (!row || !Array.isArray(row) || row.length < 4) continue;
    totalDataRows++;

    const dateStr = row[0]?.toString().trim() || "";
    const amountStr = row[3]?.toString().trim() || row[2]?.toString().trim() || "";

    // Check for AMEX date format (DD Mon. YYYY)
    const amexDatePattern = /^\d{1,2}\s+[A-Za-z]{3,4}\.?\s+\d{4}$/;
    const hasAmexDate = amexDatePattern.test(dateStr);

    // Check for $ sign in amounts
    const hasDollarSign = amountStr.includes("$");

    // Check for more than 4 columns (AMEX has ~10 columns)
    const hasMoreColumns = row.length > 6;

    if (hasAmexDate && (hasDollarSign || hasMoreColumns)) {
      amexPatternMatches++;
    }
  }

  if (totalDataRows === 0) {
    return { bankType: "AMEX", confidence: "none", reason: "" };
  }

  const matchRatio = amexPatternMatches / totalDataRows;

  if (matchRatio >= 0.8) {
    return {
      bankType: "AMEX",
      confidence: "high",
      reason: "File structure matches AMEX format (date format, column structure)"
    };
  } else if (matchRatio >= 0.5) {
    return {
      bankType: "AMEX",
      confidence: "medium",
      reason: "File partially matches AMEX format"
    };
  } else if (matchRatio >= 0.2) {
    return {
      bankType: "AMEX",
      confidence: "low",
      reason: "File may be AMEX format"
    };
  }

  return { bankType: "AMEX", confidence: "none", reason: "" };
}

/**
 * Check if file matches CIBC format
 * - No headers, data starts at row 1
 * - Date format: MM/DD/YYYY or YYYY-MM-DD
 * - 4 columns: Date, Description, Money Out, Money In
 * - No $ signs in amounts
 */
function checkForCIBC(rows: unknown[][]): BankDetectionResult {
  if (rows.length === 0) {
    return { bankType: "CIBC", confidence: "none", reason: "" };
  }

  let cibcPatternMatches = 0;
  let totalRows = 0;

  // CIBC data starts at row 1, so check from beginning
  for (const row of rows) {
    if (!row || !Array.isArray(row) || row.length < 4) continue;
    totalRows++;

    const dateStr = row[0]?.toString().trim() || "";
    const description = row[1]?.toString().trim() || "";
    const moneyOut = row[2]?.toString().trim() || "";
    const moneyIn = row[3]?.toString().trim() || "";

    // Check for CIBC date formats (MM/DD/YYYY or YYYY-MM-DD)
    const cibcDatePattern1 = /^\d{1,2}\/\d{1,2}\/\d{4}$/; // MM/DD/YYYY
    const cibcDatePattern2 = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
    const hasCibcDate = cibcDatePattern1.test(dateStr) || cibcDatePattern2.test(dateStr);

    // Check for no $ signs in amounts
    const noDollarSigns = !moneyOut.includes("$") && !moneyIn.includes("$");

    // Check that we have exactly 4 meaningful columns
    const hasFourColumns = row.length >= 4 && row.length <= 6;

    // Check that description exists and looks like a transaction description
    const hasDescription = description.length > 0;

    if (hasCibcDate && noDollarSigns && hasFourColumns && hasDescription) {
      cibcPatternMatches++;
    }
  }

  if (totalRows === 0) {
    return { bankType: "CIBC", confidence: "none", reason: "" };
  }

  const matchRatio = cibcPatternMatches / totalRows;

  if (matchRatio >= 0.8) {
    return {
      bankType: "CIBC",
      confidence: "high",
      reason: "File structure matches CIBC format (date format, 4 columns)"
    };
  } else if (matchRatio >= 0.5) {
    return {
      bankType: "CIBC",
      confidence: "medium",
      reason: "File partially matches CIBC format"
    };
  } else if (matchRatio >= 0.2) {
    return {
      bankType: "CIBC",
      confidence: "low",
      reason: "File may be CIBC format"
    };
  }

  return { bankType: "CIBC", confidence: "none", reason: "" };
}

/**
 * Fallback detection from filename (used as secondary check)
 */
export function detectBankFromFilename(fileName: string): BankType {
  const lowerName = fileName.toLowerCase();
  if (lowerName.startsWith("cibc") || lowerName.includes("cibc")) return "CIBC";
  if (lowerName.startsWith("summary") || lowerName.includes("amex")) return "AMEX";
  return "UNKNOWN";
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that a file can be parsed as the specified bank type
 */
export async function validateFileForBank(file: File, bankType: BankType): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (bankType === "UNKNOWN") {
    return { isValid: false, errors: ["Please select a bank type"], warnings: [] };
  }

  try {
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".xlsm");
    const isCsv = file.name.endsWith(".csv");

    let rows: unknown[][] = [];

    if (isExcel) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
    } else if (isCsv) {
      const text = await file.text();
      const result = Papa.parse(text, { skipEmptyLines: true });
      rows = result.data as unknown[][];
    } else {
      errors.push("Unsupported file format. Please use CSV or Excel files.");
      return { isValid: false, errors, warnings };
    }

    if (rows.length === 0) {
      errors.push("File is empty");
      return { isValid: false, errors, warnings };
    }

    if (bankType === "AMEX") {
      return validateAMEXFile(rows, isExcel);
    } else if (bankType === "CIBC") {
      return validateCIBCFile(rows);
    }

    return { isValid: true, errors: [], warnings: [] };
  } catch (error) {
    errors.push(`Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`);
    return { isValid: false, errors, warnings };
  }
}

/**
 * Validate AMEX file structure
 */
function validateAMEXFile(rows: unknown[][], isExcel: boolean): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // AMEX requires Excel format
  if (!isExcel) {
    errors.push("AMEX files must be in Excel format (.xlsx)");
    return { isValid: false, errors, warnings };
  }

  // AMEX requires at least 13 rows (12 header rows + 1 data row)
  if (rows.length < 13) {
    errors.push("File doesn't have enough rows. AMEX files should have data starting at row 13.");
    return { isValid: false, errors, warnings };
  }

  // Check data rows
  const dataRows = rows.slice(12);
  if (dataRows.length === 0) {
    errors.push("No transaction data found after row 12");
    return { isValid: false, errors, warnings };
  }

  // Validate first few data rows
  let validRows = 0;
  let invalidDateRows = 0;
  let missingAmountRows = 0;

  for (let i = 0; i < Math.min(dataRows.length, 10); i++) {
    const row = dataRows[i];
    if (!row || !Array.isArray(row) || row.length < 3) continue;

    const dateStr = row[0]?.toString().trim() || "";
    const amountStr = row[3]?.toString().trim() || row[2]?.toString().trim() || "";

    // Check date format (DD Mon. YYYY)
    const amexDatePattern = /^\d{1,2}\s+[A-Za-z]{3,4}\.?\s+\d{4}$/;
    if (!amexDatePattern.test(dateStr)) {
      invalidDateRows++;
    }

    // Check for amount
    if (!amountStr || amountStr === "") {
      missingAmountRows++;
    }

    validRows++;
  }

  if (validRows === 0) {
    errors.push("No valid transaction rows found");
    return { isValid: false, errors, warnings };
  }

  if (invalidDateRows > validRows / 2) {
    errors.push("Date format doesn't match AMEX format (expected: DD Mon. YYYY, e.g., '16 Dec. 2025')");
  }

  if (missingAmountRows > validRows / 2) {
    warnings.push("Some rows are missing amount values");
  }

  // Check column count
  const firstDataRow = dataRows.find(r => Array.isArray(r) && r.length > 0);
  if (firstDataRow && firstDataRow.length < 4) {
    errors.push(`Expected at least 4 columns for AMEX, found ${firstDataRow.length}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate CIBC file structure
 */
function validateCIBCFile(rows: unknown[][]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (rows.length === 0) {
    errors.push("File is empty");
    return { isValid: false, errors, warnings };
  }

  // Validate first few rows
  let validRows = 0;
  let invalidDateRows = 0;
  let missingDescriptionRows = 0;

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row) || row.length < 4) {
      if (row && Array.isArray(row) && row.length > 0 && row.length < 4) {
        errors.push(`Row ${i + 1} has only ${row.length} columns, expected 4 (Date, Description, Money Out, Money In)`);
      }
      continue;
    }

    validRows++;

    const dateStr = row[0]?.toString().trim() || "";
    const description = row[1]?.toString().trim() || "";

    // Check date format (MM/DD/YYYY or YYYY-MM-DD)
    const cibcDatePattern1 = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    const cibcDatePattern2 = /^\d{4}-\d{2}-\d{2}$/;
    if (!cibcDatePattern1.test(dateStr) && !cibcDatePattern2.test(dateStr)) {
      invalidDateRows++;
    }

    if (!description) {
      missingDescriptionRows++;
    }
  }

  if (validRows === 0) {
    errors.push("No valid rows found. CIBC files need 4 columns: Date, Description, Money Out, Money In");
    return { isValid: false, errors, warnings };
  }

  if (invalidDateRows > validRows / 2) {
    errors.push("Date format doesn't match CIBC format (expected: MM/DD/YYYY or YYYY-MM-DD)");
  }

  if (missingDescriptionRows > validRows / 2) {
    warnings.push("Some rows are missing descriptions");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
