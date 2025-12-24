import { Transaction, CategorizationSummary } from "./types";
import { DbCategory } from "./db";

// Type alias for categories that can be used with the categorizer
// Supports both legacy Category (id: string) and DbCategory (uuid: string)
type CategorizerCategory = { id?: string | number; uuid?: string; name: string; keywords: string[] };

// Get the string ID from a category (either id or uuid)
function getCategoryId(cat: CategorizerCategory): string {
  if (typeof cat.uuid === 'string') return cat.uuid;
  if (typeof cat.id === 'string') return cat.id;
  if (typeof cat.id === 'number') return cat.id.toString();
  return '';
}

/**
 * Categorize transactions based on keyword matching
 * Returns updated transactions with categoryId and conflict flags set
 */
export function categorizeTransactions(
  transactions: Transaction[],
  categories: CategorizerCategory[]
): Transaction[] {
  return transactions.map((transaction) => {
    const matches = findMatchingCategories(transaction.matchField, categories);

    if (matches.length === 0) {
      // No matches - uncategorized
      return {
        ...transaction,
        categoryId: null,
        isConflict: false,
        conflictingCategories: undefined,
      };
    } else if (matches.length === 1) {
      // Single match - categorized
      return {
        ...transaction,
        categoryId: getCategoryId(matches[0]),
        isConflict: false,
        conflictingCategories: undefined,
      };
    } else {
      // Multiple matches - conflict
      return {
        ...transaction,
        categoryId: null,
        isConflict: true,
        conflictingCategories: matches.map((cat) => getCategoryId(cat)),
      };
    }
  });
}

/**
 * Find all categories that match the given text
 * Uses case-insensitive partial string matching
 */
export function findMatchingCategories<T extends CategorizerCategory>(
  text: string,
  categories: T[]
): T[] {
  const matches: T[] = [];
  const lowerText = text.toLowerCase();

  for (const category of categories) {
    const hasMatch = category.keywords.some((keyword) =>
      lowerText.includes(keyword.toLowerCase())
    );

    if (hasMatch) {
      matches.push(category);
    }
  }

  return matches;
}

/**
 * Get categorization summary statistics
 */
export function getCategorizationSummary(
  transactions: Transaction[]
): CategorizationSummary {
  const total = transactions.length;
  let categorized = 0;
  let conflicts = 0;
  let uncategorized = 0;
  let duplicates = 0;

  transactions.forEach((transaction) => {
    // Count duplicates that haven't been handled (neither allowed nor ignored)
    if (transaction.isDuplicate && !transaction.allowDuplicate && !transaction.ignoreDuplicate) {
      duplicates++;
    }

    if (transaction.isConflict) {
      // Only count as conflict if not yet resolved (no categoryId)
      if (!transaction.categoryId) {
        conflicts++;
      } else {
        categorized++;
      }
    } else if (transaction.categoryId) {
      categorized++;
    } else if (!transaction.isIgnored) {
      // Only count as uncategorized if not explicitly ignored
      uncategorized++;
    }
  });

  return { categorized, conflicts, uncategorized, duplicates, total };
}

/**
 * Manually assign a category to a transaction (for conflict resolution)
 * Keeps isConflict true so we know it was originally a conflict (for UI purposes)
 */
export function assignCategory(
  transaction: Transaction,
  categoryId: string
): Transaction {
  return {
    ...transaction,
    categoryId,
    // Keep isConflict and conflictingCategories so we can show resolved status
  };
}

/**
 * Get all transactions for a specific category
 * Optionally filter by date range
 */
export function getTransactionsByCategory(
  transactions: Transaction[],
  categoryId: string,
  startDate?: Date,
  endDate?: Date
): Transaction[] {
  return transactions.filter((transaction) => {
    if (transaction.categoryId !== categoryId) {
      return false;
    }

    if (startDate && transaction.date < startDate) {
      return false;
    }

    if (endDate && transaction.date > endDate) {
      return false;
    }

    return true;
  });
}

/**
 * Calculate net total for a category
 * Optionally filter by date range
 */
export function getCategoryTotal(
  transactions: Transaction[],
  categoryId: string,
  startDate?: Date,
  endDate?: Date
): number {
  const categoryTransactions = getTransactionsByCategory(
    transactions,
    categoryId,
    startDate,
    endDate
  );

  return categoryTransactions.reduce(
    (sum, transaction) => sum + transaction.netAmount,
    0
  );
}

/**
 * Get unique years from transactions
 */
export function getAvailableYears(transactions: Transaction[]): number[] {
  const years = new Set<number>();
  transactions.forEach((transaction) => {
    years.add(transaction.date.getFullYear());
  });
  return Array.from(years).sort((a, b) => b - a); // Sort descending
}

/**
 * Get unique year-month combinations from transactions
 */
export function getAvailableMonths(
  transactions: Transaction[]
): Array<{ year: number; month: number }> {
  const months = new Set<string>();
  transactions.forEach((transaction) => {
    const year = transaction.date.getFullYear();
    const month = transaction.date.getMonth();
    months.add(`${year}-${month}`);
  });

  return Array.from(months)
    .map((key) => {
      const [year, month] = key.split("-");
      return { year: parseInt(year), month: parseInt(month) };
    })
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year; // Descending year
      return b.month - a.month; // Descending month
    });
}

/**
 * Filter transactions by date range
 */
export function filterTransactionsByDate(
  transactions: Transaction[],
  year?: number,
  month?: number
): Transaction[] {
  if (!year && month === undefined) {
    return transactions; // No filter
  }

  return transactions.filter((transaction) => {
    const txYear = transaction.date.getFullYear();
    const txMonth = transaction.date.getMonth();

    if (year && month !== undefined) {
      // Filter by specific month
      return txYear === year && txMonth === month;
    } else if (year) {
      // Filter by year only
      return txYear === year;
    }

    return true;
  });
}
