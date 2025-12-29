/**
 * Unified transaction format after parsing
 */
export interface Transaction {
  id: string; // Generated UUID
  date: Date;
  description: string; // Original description text
  matchField: string; // The field used for keyword matching
  amountOut: number; // Money leaving account (positive)
  amountIn: number; // Money entering account (positive)
  netAmount: number; // amountIn - amountOut
  source: "CIBC" | "AMEX";
  categoryId: string | null; // null if uncategorized
  isConflict: boolean; // true if matched multiple categories
  conflictingCategories?: string[]; // Category IDs if conflict
  isDuplicate?: boolean; // true if exists in database already
  importDuplicate?: boolean; // user explicitly chose to import this duplicate anyway
  skipDuplicate?: boolean; // user explicitly chose to skip (not import) this duplicate
}

/**
 * Category with keywords for matching
 */
export interface Category {
  id: string;
  name: string;
  keywords: string[];
}

/**
 * Category store format (persisted in JSON)
 */
export interface CategoryStore {
  categories: Category[];
}

/**
 * Result of file parsing
 */
export interface ParseResult {
  transactions: Transaction[];
  errors: string[];
}

/**
 * Uploaded file metadata
 */
export interface UploadedFile {
  file: File;
  bankType: "CIBC" | "AMEX" | "UNKNOWN";
  detectionConfidence?: "high" | "medium" | "low" | "none";
  detectionReason?: string;
  isManuallySet?: boolean;
  validationErrors?: string[];
  validationWarnings?: string[];
}

/**
 * Categorization summary
 */
export interface CategorizationSummary {
  categorized: number;
  conflicts: number;
  uncategorized: number;
  duplicates: number;
  total: number;
}

/**
 * App wizard steps
 */
export type WizardStep = "upload" | "resolve" | "results";

/**
 * Date filter options
 */
export interface DateFilter {
  type: "all" | "year" | "month";
  year?: number;
  month?: number; // 0-11 (JavaScript month indexing)
}
