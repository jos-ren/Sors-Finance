/**
 * Bank Parser Registry
 *
 * This module provides the central registry for all bank parsers.
 * New parsers are automatically registered when added to the banks/ directory.
 *
 * Usage:
 *   import { parseFile, detectBank, getParser, getAllParsers } from '@/lib/parsers';
 *
 *   // Detect which bank a file is from
 *   const detection = await detectBank(file);
 *
 *   // Parse a file with a specific bank parser
 *   const result = await parseFile(file, 'CIBC');
 *
 *   // Get all available parsers
 *   const parsers = getAllParsers();
 */

import type {
  BankParser,
  BankDetectionResult,
  ValidationResult,
  ParseResult,
  ParsedTransaction,
  BankParserMeta,
  FilenamePattern,
  ColumnMapping,
} from "./types";
import { readFileToRows } from "./utils";
import { createCustomParser } from "./banks/custom";

// Import all bank parsers
// To add a new bank, create a file in banks/ and import it here
import { cibcParser } from "./banks/cibc";
import { amexParser } from "./banks/amex";
import { customParser } from "./banks/custom";

// ============================================
// Parser Registry
// ============================================

/**
 * All registered bank parsers
 * Add new parsers to this array
 */
const PARSERS: BankParser[] = [
  cibcParser,
  amexParser,
  customParser, // Custom import with user-defined column mapping
  // Add new parsers here:
  // tdParser,
  // rbcParser,
];

/**
 * Map of bank ID to parser for quick lookup
 */
const PARSER_MAP = new Map<string, BankParser>(
  PARSERS.map(p => [p.meta.id, p])
);

/**
 * Filename patterns for quick detection
 */
const FILENAME_PATTERNS: FilenamePattern[] = [
  { bankId: "CIBC", pattern: /cibc/i },
  { bankId: "AMEX", pattern: /^summary|amex/i },
  // Add patterns for new banks here
];

// ============================================
// Public API
// ============================================

/**
 * Get all registered bank parsers
 */
export function getAllParsers(): BankParser[] {
  return [...PARSERS];
}

/**
 * Get parser metadata for all banks (useful for UI dropdowns)
 */
export function getAllBankMeta(): BankParserMeta[] {
  return PARSERS.map(p => p.meta);
}

/**
 * Get all supported bank IDs
 */
export function getAllBankIds(): string[] {
  return PARSERS.map(p => p.meta.id);
}

/**
 * Get a specific parser by bank ID
 */
export function getParser(bankId: string): BankParser | undefined {
  return PARSER_MAP.get(bankId);
}

/**
 * Check if a bank ID is supported
 */
export function isSupportedBank(bankId: string): boolean {
  return PARSER_MAP.has(bankId);
}

/**
 * Result of bank detection across all parsers
 */
export interface FullDetectionResult {
  /** The best matching bank ID, or null if no match */
  bankId: string | null;
  /** Confidence level of the best match */
  confidence: BankDetectionResult["confidence"];
  /** Reason for the detection */
  reason: string;
  /** All detection results from each parser */
  allResults: Array<{ bankId: string; result: BankDetectionResult }>;
}

/**
 * Detect which bank a file is from by analyzing its contents
 * Tries all registered parsers and returns the best match
 */
export async function detectBank(file: File): Promise<FullDetectionResult> {
  try {
    const rows = await readFileToRows(file);

    // Try each parser
    const results: Array<{ bankId: string; result: BankDetectionResult }> = [];

    for (const parser of PARSERS) {
      const result = parser.detect(file, rows);
      results.push({ bankId: parser.meta.id, result });
    }

    // Find the best match (highest confidence that detected)
    const confidenceOrder = ["high", "medium", "low", "none"] as const;
    let bestMatch: { bankId: string; result: BankDetectionResult } | null = null;

    for (const level of confidenceOrder) {
      const match = results.find(r => r.result.detected && r.result.confidence === level);
      if (match) {
        bestMatch = match;
        break;
      }
    }

    // If no content match, try filename patterns as fallback
    if (!bestMatch) {
      for (const pattern of FILENAME_PATTERNS) {
        if (pattern.pattern.test(file.name)) {
          return {
            bankId: pattern.bankId,
            confidence: "low",
            reason: `Filename suggests ${pattern.bankId} format`,
            allResults: results,
          };
        }
      }
    }

    if (bestMatch) {
      return {
        bankId: bestMatch.bankId,
        confidence: bestMatch.result.confidence,
        reason: bestMatch.result.reason,
        allResults: results,
      };
    }

    return {
      bankId: null,
      confidence: "none",
      reason: "Could not determine bank type from file contents or filename",
      allResults: results,
    };
  } catch (error) {
    return {
      bankId: null,
      confidence: "none",
      reason: `Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`,
      allResults: [],
    };
  }
}

/**
 * Detect bank from filename only (quick check without reading contents)
 */
export function detectBankFromFilename(fileName: string): string | null {
  for (const pattern of FILENAME_PATTERNS) {
    if (pattern.pattern.test(fileName)) {
      return pattern.bankId;
    }
  }
  return null;
}

/**
 * Validate a file for a specific bank format
 */
export async function validateFile(file: File, bankId: string): Promise<ValidationResult> {
  const parser = PARSER_MAP.get(bankId);
  if (!parser) {
    return {
      isValid: false,
      errors: [`Unknown bank type: ${bankId}`],
      warnings: [],
    };
  }

  try {
    const rows = await readFileToRows(file);
    return parser.validate(file, rows);
  } catch (error) {
    return {
      isValid: false,
      errors: [`Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`],
      warnings: [],
    };
  }
}

/**
 * Full result of parsing a file
 */
export interface FullParseResult extends ParseResult {
  /** The bank ID that was used to parse */
  bankId: string;
}

/**
 * Parse a file using a specific bank parser
 */
export async function parseFile(file: File, bankId: string, columnMapping?: ColumnMapping): Promise<FullParseResult> {
  // Handle custom parser with column mapping
  if (bankId === "CUSTOM") {
    if (!columnMapping) {
      return {
        bankId,
        transactions: [],
        errors: ["Column mapping is required for custom imports"],
      };
    }
    return parseFileWithMapping(file, columnMapping);
  }

  const parser = PARSER_MAP.get(bankId);
  if (!parser) {
    return {
      bankId,
      transactions: [],
      errors: [`Unknown bank type: ${bankId}`],
    };
  }

  try {
    const rows = await readFileToRows(file);

    // Validate first
    const validation = parser.validate(file, rows);
    if (!validation.isValid) {
      return {
        bankId,
        transactions: [],
        errors: validation.errors,
      };
    }

    // Parse
    const result = parser.parse(file, rows);
    return {
      bankId,
      ...result,
    };
  } catch (error) {
    return {
      bankId,
      transactions: [],
      errors: [`Error parsing file: ${error instanceof Error ? error.message : "Unknown error"}`],
    };
  }
}

/**
 * Parse a file using custom column mapping
 */
export async function parseFileWithMapping(file: File, columnMapping: ColumnMapping): Promise<FullParseResult> {
  try {
    const rows = await readFileToRows(file);

    // Create a custom parser instance with the provided mapping
    const parser = createCustomParser(columnMapping);

    // Validate first
    const validation = parser.validate(file, rows);
    if (!validation.isValid) {
      return {
        bankId: "CUSTOM",
        transactions: [],
        errors: validation.errors,
      };
    }

    // Parse
    const result = parser.parse(file, rows);
    return {
      bankId: "CUSTOM",
      ...result,
    };
  } catch (error) {
    return {
      bankId: "CUSTOM",
      transactions: [],
      errors: [`Error parsing file: ${error instanceof Error ? error.message : "Unknown error"}`],
    };
  }
}

// ============================================
// Re-exports
// ============================================

export type {
  BankParser,
  BankDetectionResult,
  ValidationResult,
  ParseResult,
  BankParserMeta,
} from "./types";

export type { ParsedTransaction } from "./types";

export { readFileToRows } from "./utils";
