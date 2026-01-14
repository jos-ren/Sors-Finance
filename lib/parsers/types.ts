/**
 * Bank Parser Types
 *
 * This module defines the interfaces for the extensible bank parser system.
 * Contributors adding new bank support should implement the BankParser interface.
 */

/**
 * Confidence level for bank detection
 */
export type DetectionConfidence = "high" | "medium" | "low" | "none";

/**
 * Result of attempting to detect a bank type from file contents
 */
export interface BankDetectionResult {
  /** Whether this parser can handle the file */
  detected: boolean;
  /** Confidence level of the detection */
  confidence: DetectionConfidence;
  /** Human-readable reason for the detection result */
  reason: string;
}

/**
 * Result of validating a file for a specific bank format
 */
export interface ValidationResult {
  /** Whether the file is valid for this bank format */
  isValid: boolean;
  /** Critical errors that prevent parsing */
  errors: string[];
  /** Warnings that don't prevent parsing but may indicate issues */
  warnings: string[];
}

/**
 * A parsed transaction from a bank file
 */
export interface ParsedTransaction {
  /** Transaction date */
  date: Date;
  /** Display description */
  description: string;
  /** Field used for keyword matching (may differ from description) */
  matchField: string;
  /** Money leaving account (positive number) */
  amountOut: number;
  /** Money entering account (positive number) */
  amountIn: number;
  /** Net amount (amountIn - amountOut) */
  netAmount: number;
}

/**
 * Result of parsing a bank file
 */
export interface ParseResult {
  /** Successfully parsed transactions */
  transactions: ParsedTransaction[];
  /** Errors encountered during parsing */
  errors: string[];
}

/**
 * Metadata about a bank parser
 */
export interface BankParserMeta {
  /** Unique identifier for this bank (used in database, must be stable) */
  id: string;
  /** Display name for the bank */
  name: string;
  /** Country/region code (e.g., "CA" for Canada, "US" for USA) */
  country: string;
  /** Supported file extensions */
  supportedExtensions: string[];
  /** Brief description of the expected file format */
  formatDescription: string;
  /** URL to instructions for exporting from this bank (optional) */
  exportInstructionsUrl?: string;
}

/**
 * The main interface that all bank parsers must implement.
 *
 * To add support for a new bank:
 * 1. Create a new file in lib/parsers/banks/
 * 2. Implement the BankParser interface
 * 3. Export your parser - it will be auto-registered
 *
 * See lib/parsers/banks/_template.ts for a starting point.
 */
export interface BankParser {
  /** Metadata about this bank parser */
  meta: BankParserMeta;

  /**
   * Detect if this parser can handle the given file.
   * Called during file upload to suggest the correct bank type.
   *
   * @param file - The uploaded file
   * @param rows - Pre-parsed rows from the file (CSV/Excel already converted to arrays)
   * @returns Detection result with confidence level
   */
  detect(file: File, rows: unknown[][]): BankDetectionResult;

  /**
   * Validate that a file matches the expected format for this bank.
   * Called before parsing to give users feedback on file issues.
   *
   * @param file - The uploaded file
   * @param rows - Pre-parsed rows from the file
   * @returns Validation result with errors and warnings
   */
  validate(file: File, rows: unknown[][]): ValidationResult;

  /**
   * Parse transactions from the file.
   * Only called after successful validation.
   *
   * @param file - The uploaded file
   * @param rows - Pre-parsed rows from the file
   * @returns Parsed transactions and any errors
   */
  parse(file: File, rows: unknown[][]): ParseResult;
}

/**
 * Filename patterns that suggest a specific bank
 */
export interface FilenamePattern {
  /** Bank ID this pattern matches */
  bankId: string;
  /** Regex pattern to match against filename */
  pattern: RegExp;
}

/**
 * Column mapping configuration for custom imports
 */
export interface ColumnMapping {
  /** Index of the date column */
  dateColumn: number;
  /** Date format (optional, auto-detected if not provided) */
  dateFormat?: string;
  /** Index of the description column */
  descriptionColumn: number;
  /** Index of the amount in column */
  amountInColumn: number;
  /** Index of the amount out column */
  amountOutColumn: number;
  /** Indices of columns to use for match field (defaults to description) */
  matchFieldColumns?: number[];
  /** Whether the first row contains headers */
  hasHeaders?: boolean;
  /** If both amount columns map to same index, use negative values for out */
  useNegativeForOut?: boolean;
}

/**
 * Auto-detected column information
 */
export interface DetectedColumn {
  /** Column index */
  index: number;
  /** Detected header name (if hasHeaders is true) */
  header?: string;
  /** Confidence that this column matches the target field */
  confidence: "high" | "medium" | "low";
  /** Reason for the detection */
  reason: string;
}

/**
 * Result of auto-detecting columns
 */
export interface ColumnDetectionResult {
  /** Detected date column */
  dateColumn?: DetectedColumn;
  /** Detected description column */
  descriptionColumn?: DetectedColumn;
  /** Detected amount in column */
  amountInColumn?: DetectedColumn;
  /** Detected amount out column */
  amountOutColumn?: DetectedColumn;
  /** Whether first row appears to be headers */
  hasHeaders: boolean;
  /** Auto-detected date format */
  dateFormat?: string;
}
