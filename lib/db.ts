import Dexie, { Table } from 'dexie';

// ============================================
// Database Types
// ============================================

export interface DbCategory {
  id?: number;
  uuid: string;           // Keep UUID for backwards compatibility
  name: string;
  keywords: string[];
  order: number;          // For manual ordering
  isSystem?: boolean;     // System categories (Excluded, Uncategorized) cannot be deleted
  createdAt: Date;
  updatedAt: Date;
}

// System category names
export const SYSTEM_CATEGORIES = {
  EXCLUDED: 'Excluded',
  UNCATEGORIZED: 'Uncategorized',
} as const;

export interface DbTransaction {
  id?: number;
  uuid: string;
  date: Date;
  description: string;
  matchField: string;     // Field used for keyword matching
  amountOut: number;      // Money leaving (positive)
  amountIn: number;       // Money entering (positive)
  netAmount: number;      // amountIn - amountOut
  source: 'CIBC' | 'AMEX' | 'Manual';
  categoryId: number | null;  // FK to categories
  importId: number | null;    // FK to imports (which batch it came from)
  createdAt: Date;
  updatedAt: Date;
}

export interface DbBudget {
  id?: number;
  categoryId: number;     // FK to categories
  year: number;
  month: number | null;   // null = yearly budget, 0-11 = monthly
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbImport {
  id?: number;
  fileName: string;
  source: 'CIBC' | 'AMEX';
  transactionCount: number;
  totalAmount: number;
  importedAt: Date;
}

export interface DbSettings {
  id?: number;
  key: string;
  value: string;
}

// ============================================
// Portfolio Types (Net Worth Tracking)
// ============================================

// The 4 fixed bucket types for portfolio
export const BUCKET_TYPES = ['Savings', 'Investments', 'Assets', 'Debt'] as const;
export type BucketType = (typeof BUCKET_TYPES)[number];

// User-created accounts within buckets (e.g., "Crypto", "Real Estate", "Credit Cards")
export interface DbPortfolioAccount {
  id?: number;
  uuid: string;
  bucket: BucketType;           // Which bucket this belongs to
  name: string;                 // e.g., "Crypto", "Real Estate", "Credit Cards"
  order: number;                // Display order within bucket
  createdAt: Date;
  updatedAt: Date;
}

// Price mode for investment items
export type PriceMode = 'manual' | 'ticker';

// Individual items (holdings, debts, etc.)
export interface DbPortfolioItem {
  id?: number;
  uuid: string;
  accountId: number;            // FK to DbPortfolioAccount
  name: string;                 // e.g., "Bitcoin", "TD Chequing", "Visa Infinite"
  currentValue: number;         // Current value/balance (in user's base currency)
  notes?: string;
  order: number;                // Display order within category
  isActive: boolean;            // Soft delete
  createdAt: Date;
  updatedAt: Date;

  // Investment tracking fields (optional, for stocks/crypto)
  ticker?: string;              // Stock/crypto ticker (e.g., "AAPL", "BTC-USD")
  quantity?: number;            // Number of shares/units owned
  pricePerUnit?: number;        // Current price per share (in original currency)
  currency?: string;            // Original currency (e.g., "USD", "CAD")
  lastPriceUpdate?: Date;       // When price was last fetched from API
  priceMode?: PriceMode;        // 'ticker' = auto-fetch from API, 'manual' = user-entered price
}

// Point-in-time snapshots for history
export interface DbPortfolioSnapshot {
  id?: number;
  uuid: string;
  date: Date;
  totalSavings: number;
  totalInvestments: number;
  totalAssets: number;
  totalDebt: number;
  netWorth: number;             // (Savings + Investments + Assets) - Debt
  details: {                    // Full breakdown at snapshot time
    accounts: Array<{ id: number; bucket: BucketType; name: string; total: number }>;
    items: Array<{ id: number; accountId: number; name: string; value: number }>;
  };
  createdAt: Date;
}

// ============================================
// Database Class
// ============================================

class SorsDatabase extends Dexie {
  categories!: Table<DbCategory>;
  transactions!: Table<DbTransaction>;
  budgets!: Table<DbBudget>;
  imports!: Table<DbImport>;
  settings!: Table<DbSettings>;
  portfolioAccounts!: Table<DbPortfolioAccount>;
  portfolioItems!: Table<DbPortfolioItem>;
  portfolioSnapshots!: Table<DbPortfolioSnapshot>;

  constructor() {
    super('sors-finance');

    this.version(1).stores({
      // ++id = auto-increment primary key
      // & = unique index
      // other fields = indexed for queries
      categories: '++id, &uuid, name, order',
      transactions: '++id, &uuid, date, categoryId, source, importId, [date+categoryId]',
      budgets: '++id, categoryId, year, month, [year+month], [year+month+categoryId]',
      imports: '++id, source, importedAt',
      settings: '++id, &key'
    });

    // Version 2: Add isSystem flag to categories
    this.version(2).stores({
      categories: '++id, &uuid, name, order, isSystem',
      transactions: '++id, &uuid, date, categoryId, source, importId, [date+categoryId]',
      budgets: '++id, categoryId, year, month, [year+month], [year+month+categoryId]',
      imports: '++id, source, importedAt',
      settings: '++id, &key'
    });

    // Version 3: Add portfolio tables for net worth tracking
    this.version(3).stores({
      categories: '++id, &uuid, name, order, isSystem',
      transactions: '++id, &uuid, date, categoryId, source, importId, [date+categoryId]',
      budgets: '++id, categoryId, year, month, [year+month], [year+month+categoryId]',
      imports: '++id, source, importedAt',
      settings: '++id, &key',
      portfolioAccounts: '++id, &uuid, bucket, order',
      portfolioItems: '++id, &uuid, accountId, isActive, order',
      portfolioSnapshots: '++id, &uuid, date'
    });
  }
}

// ============================================
// Database Instance
// ============================================

export const db = new SorsDatabase();

// ============================================
// Category Operations
// ============================================

export async function getCategories(): Promise<DbCategory[]> {
  return db.categories.orderBy('order').toArray();
}

export async function getCategoryById(id: number): Promise<DbCategory | undefined> {
  return db.categories.get(id);
}

export async function getCategoryByUuid(uuid: string): Promise<DbCategory | undefined> {
  return db.categories.where('uuid').equals(uuid).first();
}

export async function addCategory(name: string, keywords: string[] = []): Promise<number> {
  const maxOrder = await db.categories.orderBy('order').last();
  const order = (maxOrder?.order ?? -1) + 1;

  return db.categories.add({
    uuid: crypto.randomUUID(),
    name,
    keywords,
    order,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

export interface UpdateCategoryResult {
  assigned: number;
  uncategorized: number;
  conflicts: number;
}

export async function updateCategory(
  id: number,
  updates: Partial<Omit<DbCategory, 'id' | 'uuid' | 'createdAt'>>
): Promise<UpdateCategoryResult> {
  const result: UpdateCategoryResult = { assigned: 0, uncategorized: 0, conflicts: 0 };

  // Get the old category data
  const oldCategory = await db.categories.get(id);
  if (!oldCategory) return result;

  const oldKeywords = oldCategory.keywords;
  const newKeywords = updates.keywords ?? oldKeywords;
  const keywordsChanged = JSON.stringify(oldKeywords.sort()) !== JSON.stringify([...newKeywords].sort());

  await db.transaction('rw', [db.categories, db.transactions], async () => {
    // Update the category
    await db.categories.update(id, {
      ...updates,
      updatedAt: new Date()
    });

    // If keywords changed, re-categorize affected transactions
    if (keywordsChanged) {
      const allCategories = await db.categories.toArray();
      const updatedCategory = { ...oldCategory, ...updates, keywords: newKeywords };

      // 1. Check transactions currently in this category - do they still match?
      const transactionsInCategory = await db.transactions
        .where('categoryId')
        .equals(id)
        .toArray();

      for (const transaction of transactionsInCategory) {
        const stillMatches = matchesKeywords(transaction.matchField, newKeywords);
        if (!stillMatches) {
          // Check if it matches another category
          const otherMatch = findMatchingCategory(transaction.matchField, allCategories, id);
          if (otherMatch) {
            await db.transactions.update(transaction.id!, {
              categoryId: otherMatch.id!,
              updatedAt: new Date()
            });
            result.assigned++;
          } else {
            await db.transactions.update(transaction.id!, {
              categoryId: null,
              updatedAt: new Date()
            });
          }
          result.uncategorized++;
        }
      }

      // 2. Check uncategorized transactions - do they now match this category?
      const allTransactions = await db.transactions.toArray();
      const uncategorizedTransactions = allTransactions.filter(t => t.categoryId === null);

      for (const transaction of uncategorizedTransactions) {
        const matchesThis = matchesKeywords(transaction.matchField, newKeywords);
        if (matchesThis) {
          // Check if it also matches other categories (conflict)
          const otherCategories = allCategories.filter(c => c.id !== id);
          const otherMatches = otherCategories.filter(c =>
            matchesKeywords(transaction.matchField, c.keywords)
          );

          if (otherMatches.length === 0) {
            // Only matches this category - assign it
            await db.transactions.update(transaction.id!, {
              categoryId: id,
              updatedAt: new Date()
            });
            result.assigned++;
          } else {
            // Matches multiple categories - conflict, leave uncategorized
            result.conflicts++;
          }
        }
      }
    }
  });

  return result;
}

// Helper: check if text matches any of the keywords
function matchesKeywords(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

// Helper: find a matching category (excluding a specific category)
function findMatchingCategory(text: string, categories: DbCategory[], excludeId: number): DbCategory | null {
  const lowerText = text.toLowerCase();
  for (const category of categories) {
    if (category.id === excludeId) continue;
    if (category.keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
      return category;
    }
  }
  return null;
}

export async function deleteCategory(id: number): Promise<void> {
  // Check if this is a system category
  const category = await db.categories.get(id);
  if (category?.isSystem) {
    throw new Error('Cannot delete system categories');
  }

  await db.transaction('rw', [db.categories, db.transactions, db.budgets], async () => {
    // Remove category reference from transactions
    await db.transactions.where('categoryId').equals(id).modify({ categoryId: null });
    // Delete associated budgets
    await db.budgets.where('categoryId').equals(id).delete();
    // Delete the category
    await db.categories.delete(id);
  });
}

export async function reorderCategories(activeId: number, overId: number): Promise<void> {
  const categories = await db.categories.orderBy('order').toArray();
  const activeIndex = categories.findIndex(c => c.id === activeId);
  const overIndex = categories.findIndex(c => c.id === overId);

  if (activeIndex === -1 || overIndex === -1) return;

  const [moved] = categories.splice(activeIndex, 1);
  categories.splice(overIndex, 0, moved);

  // Update order for all categories
  await db.transaction('rw', db.categories, async () => {
    for (let i = 0; i < categories.length; i++) {
      await db.categories.update(categories[i].id!, { order: i, updatedAt: new Date() });
    }
  });
}

export async function addKeywordToCategory(categoryId: number, keyword: string): Promise<void> {
  const category = await db.categories.get(categoryId);
  if (!category) return;

  const trimmed = keyword.trim().toUpperCase();
  if (!trimmed || category.keywords.some(k => k.toUpperCase() === trimmed)) return;

  await db.categories.update(categoryId, {
    keywords: [...category.keywords, keyword.trim()],
    updatedAt: new Date()
  });
}

export async function removeKeywordFromCategory(categoryId: number, keyword: string): Promise<void> {
  const category = await db.categories.get(categoryId);
  if (!category) return;

  await db.categories.update(categoryId, {
    keywords: category.keywords.filter(k => k !== keyword),
    updatedAt: new Date()
  });
}

// ============================================
// Transaction Operations
// ============================================

export async function getTransactions(options?: {
  startDate?: Date;
  endDate?: Date;
  categoryId?: number;
  source?: 'CIBC' | 'AMEX' | 'Manual';
  limit?: number;
  offset?: number;
}): Promise<DbTransaction[]> {
  let query = db.transactions.orderBy('date').reverse();

  if (options?.startDate && options?.endDate) {
    query = db.transactions.where('date').between(options.startDate, options.endDate, true, true).reverse();
  }

  let results = await query.toArray();

  if (options?.categoryId !== undefined) {
    results = results.filter(t => t.categoryId === options.categoryId);
  }
  if (options?.source) {
    results = results.filter(t => t.source === options.source);
  }
  if (options?.offset) {
    results = results.slice(options.offset);
  }
  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

export async function addTransaction(transaction: Omit<DbTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  return db.transactions.add({
    ...transaction,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

export async function addTransactionsBulk(
  transactions: Omit<DbTransaction, 'id' | 'createdAt' | 'updatedAt'>[],
  options?: { skipDuplicateCheck?: boolean }
): Promise<{ added: number; skipped: number }> {
  if (transactions.length === 0) {
    return { added: 0, skipped: 0 };
  }

  // If skipping duplicate check, just add all transactions
  if (options?.skipDuplicateCheck) {
    const now = new Date();
    const withTimestamps = transactions.map(t => ({
      ...t,
      createdAt: now,
      updatedAt: now
    }));
    await db.transactions.bulkAdd(withTimestamps);
    return { added: transactions.length, skipped: 0 };
  }

  // Get date range for efficient querying
  const dates = transactions.map(t => t.date);
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  // Fetch existing transactions in the date range
  const existingTransactions = await db.transactions
    .where('date')
    .between(minDate, maxDate, true, true)
    .toArray();

  // Create a Set of existing transaction signatures for fast lookup
  const existingSignatures = new Set(
    existingTransactions.map(t =>
      `${t.date.toISOString()}|${t.description}|${t.amountOut}|${t.amountIn}`
    )
  );

  // Filter out duplicates
  const newTransactions = transactions.filter(t => {
    const signature = `${t.date.toISOString()}|${t.description}|${t.amountOut}|${t.amountIn}`;
    return !existingSignatures.has(signature);
  });

  const skipped = transactions.length - newTransactions.length;

  if (newTransactions.length > 0) {
    const now = new Date();
    const withTimestamps = newTransactions.map(t => ({
      ...t,
      createdAt: now,
      updatedAt: now
    }));
    await db.transactions.bulkAdd(withTimestamps);
  }

  return { added: newTransactions.length, skipped };
}

export async function updateTransaction(id: number, updates: Partial<Omit<DbTransaction, 'id' | 'uuid' | 'createdAt'>>): Promise<void> {
  await db.transactions.update(id, {
    ...updates,
    updatedAt: new Date()
  });
}

export async function deleteTransaction(id: number): Promise<void> {
  await db.transactions.delete(id);
}

export async function deleteTransactionsBulk(ids: number[]): Promise<void> {
  await db.transactions.bulkDelete(ids);
}

export async function categorizeTransaction(id: number, categoryId: number | null): Promise<void> {
  await db.transactions.update(id, {
    categoryId,
    updatedAt: new Date()
  });
}

/**
 * Check which transactions already exist in the database (duplicates)
 * Returns a Set of transaction signatures that are duplicates
 */
export async function findDuplicateSignatures(
  transactions: Array<{ date: Date; description: string; amountOut: number; amountIn: number }>
): Promise<Set<string>> {
  if (transactions.length === 0) {
    return new Set();
  }

  // Get date range for efficient querying
  const dates = transactions.map(t => t.date);
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  // Fetch existing transactions in the date range
  const existingTransactions = await db.transactions
    .where('date')
    .between(minDate, maxDate, true, true)
    .toArray();

  // Create a Set of existing transaction signatures
  return new Set(
    existingTransactions.map(t =>
      `${t.date.toISOString()}|${t.description}|${t.amountOut}|${t.amountIn}`
    )
  );
}

// ============================================
// Budget Operations
// ============================================

export async function getBudgets(year: number, month?: number | null): Promise<DbBudget[]> {
  if (month !== undefined && month !== null) {
    return db.budgets.where('[year+month]').equals([year, month]).toArray();
  }
  return db.budgets.where('year').equals(year).toArray();
}

export async function getBudgetForCategory(categoryId: number, year: number, month?: number | null): Promise<DbBudget | undefined> {
  if (month !== undefined && month !== null) {
    return db.budgets.where('[year+month+categoryId]').equals([year, month, categoryId]).first();
  }
  return db.budgets.where({ categoryId, year, month: null }).first();
}

export async function setBudget(categoryId: number, year: number, month: number | null, amount: number): Promise<number> {
  const existing = await getBudgetForCategory(categoryId, year, month);

  if (existing?.id) {
    await db.budgets.update(existing.id, { amount, updatedAt: new Date() });
    return existing.id;
  }

  return db.budgets.add({
    categoryId,
    year,
    month,
    amount,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

export async function deleteBudget(id: number): Promise<void> {
  await db.budgets.delete(id);
}

export async function copyBudgetToMonth(fromYear: number, fromMonth: number | null, toYear: number, toMonth: number | null): Promise<void> {
  const sourceBudgets = await getBudgets(fromYear, fromMonth);

  await db.transaction('rw', db.budgets, async () => {
    for (const budget of sourceBudgets) {
      const existing = await getBudgetForCategory(budget.categoryId, toYear, toMonth);
      if (!existing) {
        await db.budgets.add({
          categoryId: budget.categoryId,
          year: toYear,
          month: toMonth,
          amount: budget.amount,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
  });
}

// ============================================
// Import Operations
// ============================================

export async function getImports(): Promise<DbImport[]> {
  return db.imports.orderBy('importedAt').reverse().toArray();
}

export async function addImport(importData: Omit<DbImport, 'id'>): Promise<number> {
  return db.imports.add(importData);
}

export async function deleteImport(id: number): Promise<void> {
  await db.transaction('rw', [db.imports, db.transactions], async () => {
    await db.transactions.where('importId').equals(id).delete();
    await db.imports.delete(id);
  });
}

// ============================================
// Settings Operations
// ============================================

export async function getSetting(key: string): Promise<string | undefined> {
  const setting = await db.settings.where('key').equals(key).first();
  return setting?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db.settings.where('key').equals(key).first();
  if (existing?.id) {
    await db.settings.update(existing.id, { value });
  } else {
    await db.settings.add({ key, value });
  }
}

// ============================================
// Aggregation Helpers
// ============================================

export async function getSpendingByCategory(year: number, month?: number): Promise<Map<number, number>> {
  let startDate: Date;
  let endDate: Date;

  if (month !== undefined) {
    startDate = new Date(year, month, 1);
    endDate = new Date(year, month + 1, 0, 23, 59, 59);
  } else {
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31, 23, 59, 59);
  }

  // Get the Excluded category to exclude from calculations
  const excludedCategory = await getExcludedCategory();
  const excludedCategoryId = excludedCategory?.id;

  const transactions = await db.transactions
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();

  const spending = new Map<number, number>();

  for (const t of transactions) {
    // Exclude "Excluded" category transactions from calculations
    if (t.categoryId !== null && t.categoryId !== excludedCategoryId && t.amountOut > 0) {
      const current = spending.get(t.categoryId) || 0;
      spending.set(t.categoryId, current + t.amountOut);
    }
  }

  return spending;
}

export async function getTotalSpending(year: number, month?: number): Promise<{ income: number; expenses: number }> {
  let startDate: Date;
  let endDate: Date;

  if (month !== undefined) {
    startDate = new Date(year, month, 1);
    endDate = new Date(year, month + 1, 0, 23, 59, 59);
  } else {
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31, 23, 59, 59);
  }

  // Get the Excluded category to exclude from calculations
  const excludedCategory = await getExcludedCategory();
  const excludedCategoryId = excludedCategory?.id;

  const transactions = await db.transactions
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();

  let income = 0;
  let expenses = 0;

  for (const t of transactions) {
    // Exclude "Excluded" category transactions from calculations
    if (t.categoryId !== excludedCategoryId) {
      income += t.amountIn;
      expenses += t.amountOut;
    }
  }

  return { income, expenses };
}

// All-time totals (no date filter)
export async function getAllTimeTotals(): Promise<{ income: number; expenses: number }> {
  const excludedCategory = await getExcludedCategory();
  const excludedCategoryId = excludedCategory?.id;

  const transactions = await db.transactions.toArray();

  let income = 0;
  let expenses = 0;

  for (const t of transactions) {
    if (t.categoryId !== excludedCategoryId) {
      income += t.amountIn;
      expenses += t.amountOut;
    }
  }

  return { income, expenses };
}

// All-time spending by category
export async function getAllTimeSpendingByCategory(): Promise<Map<number, number>> {
  const excludedCategory = await getExcludedCategory();
  const excludedCategoryId = excludedCategory?.id;

  const transactions = await db.transactions.toArray();

  const spending = new Map<number, number>();

  for (const t of transactions) {
    if (t.categoryId !== null && t.categoryId !== excludedCategoryId && t.amountOut > 0) {
      const current = spending.get(t.categoryId) || 0;
      spending.set(t.categoryId, current + t.amountOut);
    }
  }

  return spending;
}

// All-time monthly trend (across all years)
export async function getAllTimeMonthlyTrend(): Promise<Array<{
  month: number;
  year: number;
  monthName: string;
  income: number;
  expenses: number;
}>> {
  const excludedCategory = await getExcludedCategory();
  const excludedCategoryId = excludedCategory?.id;

  const transactions = await db.transactions.orderBy('date').toArray();

  if (transactions.length === 0) return [];

  // Group by year-month
  const monthlyData = new Map<string, { income: number; expenses: number; year: number; month: number }>();

  for (const t of transactions) {
    if (t.categoryId !== excludedCategoryId) {
      const year = t.date.getFullYear();
      const month = t.date.getMonth();
      const key = `${year}-${month}`;

      if (!monthlyData.has(key)) {
        monthlyData.set(key, { income: 0, expenses: 0, year, month });
      }

      const data = monthlyData.get(key)!;
      data.income += t.amountIn;
      data.expenses += t.amountOut;
    }
  }

  // Convert to sorted array
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return Array.from(monthlyData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, data]) => ({
      month: data.month,
      year: data.year,
      monthName: `${monthNames[data.month]} ${data.year}`,
      income: data.income,
      expenses: data.expenses,
    }));
}

// ============================================
// Default Data Seeding
// ============================================

// System categories (always created first, cannot be deleted)
const SYSTEM_CATEGORY_DEFS = [
  { name: SYSTEM_CATEGORIES.UNCATEGORIZED, keywords: [], isSystem: true },
  { name: SYSTEM_CATEGORIES.EXCLUDED, keywords: [], isSystem: true },
];

const DEFAULT_CATEGORIES = [
  { name: 'Groceries', keywords: ['LOBLAWS', 'METRO', 'SOBEYS', 'FARM BOY', 'WALMART', 'COSTCO'] },
  { name: 'Dining & Restaurants', keywords: ['RESTAURANT', 'MCDONALD', 'TIM HORTONS', 'STARBUCKS', 'SUBWAY', 'PIZZA'] },
  { name: 'Gas & Transportation', keywords: ['SHELL', 'ESSO', 'PETRO', 'CANADIAN TIRE GAS', 'UBER', 'LYFT', 'PRESTO'] },
  { name: 'Subscriptions', keywords: ['NETFLIX', 'SPOTIFY', 'DISNEY', 'AMAZON PRIME', 'APPLE.COM', 'GOOGLE'] },
  { name: 'Shopping', keywords: ['AMAZON', 'AMZN MKTP', 'BEST BUY', 'HOME DEPOT', 'IKEA'] },
  { name: 'Utilities & Bills', keywords: ['ROGERS', 'BELL', 'TELUS', 'HYDRO', 'ENBRIDGE', 'INSURANCE'] },
  { name: 'Healthcare', keywords: ['PHARMACY', 'SHOPPERS', 'REXALL', 'MEDICAL', 'DENTAL', 'CLINIC'] },
];

export async function seedDefaultCategories(): Promise<void> {
  const count = await db.categories.count();
  if (count > 0) {
    // Ensure system categories exist even for existing databases
    await ensureSystemCategories();
    return;
  }

  const now = new Date();
  let order = 0;

  // Add system categories first
  for (const cat of SYSTEM_CATEGORY_DEFS) {
    await db.categories.add({
      uuid: crypto.randomUUID(),
      name: cat.name,
      keywords: cat.keywords,
      order: order++,
      isSystem: cat.isSystem,
      createdAt: now,
      updatedAt: now
    });
  }

  // Add default user categories
  for (const cat of DEFAULT_CATEGORIES) {
    await db.categories.add({
      uuid: crypto.randomUUID(),
      name: cat.name,
      keywords: cat.keywords,
      order: order++,
      isSystem: false,
      createdAt: now,
      updatedAt: now
    });
  }
  console.log('Seeded default categories');
}

// Ensure system categories exist (for database migrations)
async function ensureSystemCategories(): Promise<void> {
  const now = new Date();
  const existingCategories = await db.categories.toArray();

  for (const sysCat of SYSTEM_CATEGORY_DEFS) {
    const exists = existingCategories.find(c => c.name === sysCat.name);
    if (!exists) {
      // Add missing system category at the beginning
      await db.categories.add({
        uuid: crypto.randomUUID(),
        name: sysCat.name,
        keywords: sysCat.keywords,
        order: -1, // Will be at the top
        isSystem: true,
        createdAt: now,
        updatedAt: now
      });
    } else if (!exists.isSystem) {
      // Mark existing category as system
      await db.categories.update(exists.id!, { isSystem: true, updatedAt: now });
    }
  }
}

// Get the Excluded category (for excluding from calculations)
export async function getExcludedCategory(): Promise<DbCategory | undefined> {
  return db.categories.where('name').equals(SYSTEM_CATEGORIES.EXCLUDED).first();
}

// Get the Uncategorized category
export async function getUncategorizedCategory(): Promise<DbCategory | undefined> {
  return db.categories.where('name').equals(SYSTEM_CATEGORIES.UNCATEGORIZED).first();
}

// ============================================
// Re-categorize Transactions
// ============================================

export type RecategorizeMode = 'uncategorized' | 'all';

export interface RecategorizeResult {
  processed: number;
  updated: number;
  conflicts: number;
}

/**
 * Re-categorize existing transactions based on current category keywords
 * @param mode - 'uncategorized' to only affect transactions without a category,
 *               'all' to re-categorize all transactions
 */
export async function recategorizeTransactions(mode: RecategorizeMode = 'uncategorized'): Promise<RecategorizeResult> {
  const categories = await getCategories();
  const transactions = await db.transactions.toArray();

  let processed = 0;
  let updated = 0;
  let conflicts = 0;

  await db.transaction('rw', db.transactions, async () => {
    for (const transaction of transactions) {
      // Skip if mode is 'uncategorized' and transaction already has a category
      if (mode === 'uncategorized' && transaction.categoryId !== null) {
        continue;
      }

      processed++;

      // Find matching categories based on matchField
      const matchingCategories = findMatchingCategoriesForText(transaction.matchField, categories);

      if (matchingCategories.length === 1) {
        // Single match - update category
        if (transaction.categoryId !== matchingCategories[0].id) {
          await db.transactions.update(transaction.id!, {
            categoryId: matchingCategories[0].id!,
            updatedAt: new Date()
          });
          updated++;
        }
      } else if (matchingCategories.length > 1) {
        // Multiple matches - conflict (leave uncategorized)
        conflicts++;
      }
      // No matches - leave as is
    }
  });

  return { processed, updated, conflicts };
}

/**
 * Find categories that match the given text (case-insensitive partial match)
 */
function findMatchingCategoriesForText(text: string, categories: DbCategory[]): DbCategory[] {
  const lowerText = text.toLowerCase();
  return categories.filter(category =>
    category.keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))
  );
}

// ============================================
// Portfolio Account Operations
// ============================================

export async function getPortfolioAccounts(bucket?: BucketType): Promise<DbPortfolioAccount[]> {
  if (bucket) {
    return db.portfolioAccounts.where('bucket').equals(bucket).sortBy('order');
  }
  return db.portfolioAccounts.orderBy('order').toArray();
}

export async function getPortfolioAccountById(id: number): Promise<DbPortfolioAccount | undefined> {
  return db.portfolioAccounts.get(id);
}

export async function addPortfolioAccount(
  bucket: BucketType,
  name: string
): Promise<number> {
  const accountsInBucket = await db.portfolioAccounts.where('bucket').equals(bucket).toArray();
  const maxOrder = accountsInBucket.reduce((max, c) => Math.max(max, c.order), -1);

  return db.portfolioAccounts.add({
    uuid: crypto.randomUUID(),
    bucket,
    name,
    order: maxOrder + 1,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

export async function updatePortfolioAccount(
  id: number,
  updates: Partial<Pick<DbPortfolioAccount, 'name'>>
): Promise<void> {
  await db.portfolioAccounts.update(id, {
    ...updates,
    updatedAt: new Date()
  });
}

export async function deletePortfolioAccount(id: number): Promise<void> {
  await db.transaction('rw', [db.portfolioAccounts, db.portfolioItems], async () => {
    // Delete all items in this account
    await db.portfolioItems.where('accountId').equals(id).delete();
    // Delete the account
    await db.portfolioAccounts.delete(id);
  });
}

export async function reorderPortfolioAccounts(bucket: BucketType, activeId: number, overId: number): Promise<void> {
  const accounts = await db.portfolioAccounts.where('bucket').equals(bucket).sortBy('order');
  const activeIndex = accounts.findIndex(c => c.id === activeId);
  const overIndex = accounts.findIndex(c => c.id === overId);

  if (activeIndex === -1 || overIndex === -1) return;

  const [moved] = accounts.splice(activeIndex, 1);
  accounts.splice(overIndex, 0, moved);

  await db.transaction('rw', db.portfolioAccounts, async () => {
    for (let i = 0; i < accounts.length; i++) {
      await db.portfolioAccounts.update(accounts[i].id!, { order: i, updatedAt: new Date() });
    }
  });
}

// ============================================
// Portfolio Item Operations
// ============================================

export async function getPortfolioItems(accountId?: number, includeInactive = false): Promise<DbPortfolioItem[]> {
  let items: DbPortfolioItem[];

  if (accountId !== undefined) {
    items = await db.portfolioItems.where('accountId').equals(accountId).sortBy('order');
  } else {
    items = await db.portfolioItems.orderBy('order').toArray();
  }

  if (!includeInactive) {
    items = items.filter(i => i.isActive);
  }

  return items;
}

export async function getPortfolioItemById(id: number): Promise<DbPortfolioItem | undefined> {
  return db.portfolioItems.get(id);
}

export interface AddPortfolioItemData {
  accountId: number;
  name: string;
  currentValue: number;
  notes?: string;
  // Investment tracking fields
  ticker?: string;
  quantity?: number;
  pricePerUnit?: number;
  currency?: string;
  lastPriceUpdate?: Date;
  priceMode?: PriceMode;
}

export async function addPortfolioItem(data: AddPortfolioItemData): Promise<number> {
  const itemsInAccount = await db.portfolioItems.where('accountId').equals(data.accountId).toArray();
  const maxOrder = itemsInAccount.reduce((max, i) => Math.max(max, i.order), -1);

  return db.portfolioItems.add({
    uuid: crypto.randomUUID(),
    accountId: data.accountId,
    name: data.name,
    currentValue: data.currentValue,
    notes: data.notes,
    ticker: data.ticker,
    quantity: data.quantity,
    pricePerUnit: data.pricePerUnit,
    currency: data.currency,
    lastPriceUpdate: data.lastPriceUpdate,
    priceMode: data.priceMode ?? (data.ticker ? 'ticker' : 'manual'),
    order: maxOrder + 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

export async function updatePortfolioItem(
  id: number,
  updates: Partial<Pick<DbPortfolioItem, 'name' | 'currentValue' | 'notes' | 'accountId' | 'ticker' | 'quantity' | 'pricePerUnit' | 'currency' | 'lastPriceUpdate' | 'priceMode'>>
): Promise<void> {
  await db.portfolioItems.update(id, {
    ...updates,
    updatedAt: new Date()
  });
}

export async function deletePortfolioItem(id: number, hard = false): Promise<void> {
  if (hard) {
    await db.portfolioItems.delete(id);
  } else {
    await db.portfolioItems.update(id, { isActive: false, updatedAt: new Date() });
  }
}

export async function restorePortfolioItem(id: number): Promise<void> {
  await db.portfolioItems.update(id, { isActive: true, updatedAt: new Date() });
}

export async function reorderPortfolioItems(accountId: number, activeId: number, overId: number): Promise<void> {
  const items = await db.portfolioItems
    .where('accountId')
    .equals(accountId)
    .filter(i => i.isActive)
    .sortBy('order');

  const activeIndex = items.findIndex(i => i.id === activeId);
  const overIndex = items.findIndex(i => i.id === overId);

  if (activeIndex === -1 || overIndex === -1) return;

  const [moved] = items.splice(activeIndex, 1);
  items.splice(overIndex, 0, moved);

  await db.transaction('rw', db.portfolioItems, async () => {
    for (let i = 0; i < items.length; i++) {
      await db.portfolioItems.update(items[i].id!, { order: i, updatedAt: new Date() });
    }
  });
}

// ============================================
// Portfolio Aggregation Operations
// ============================================

export async function getBucketTotal(bucket: BucketType): Promise<number> {
  const accounts = await db.portfolioAccounts.where('bucket').equals(bucket).toArray();
  const accountIds = accounts.map(c => c.id!);

  if (accountIds.length === 0) return 0;

  const items = await db.portfolioItems
    .where('accountId')
    .anyOf(accountIds)
    .filter(i => i.isActive)
    .toArray();

  return items.reduce((sum, i) => sum + i.currentValue, 0);
}

export async function getPortfolioAccountTotal(accountId: number): Promise<number> {
  const items = await db.portfolioItems
    .where('accountId')
    .equals(accountId)
    .filter(i => i.isActive)
    .toArray();

  return items.reduce((sum, i) => sum + i.currentValue, 0);
}

export async function getNetWorthSummary(): Promise<{
  totalSavings: number;
  totalInvestments: number;
  totalAssets: number;
  totalDebt: number;
  netWorth: number;
}> {
  const [savings, investments, assets, debt] = await Promise.all([
    getBucketTotal('Savings'),
    getBucketTotal('Investments'),
    getBucketTotal('Assets'),
    getBucketTotal('Debt')
  ]);

  return {
    totalSavings: savings,
    totalInvestments: investments,
    totalAssets: assets,
    totalDebt: debt,
    netWorth: savings + investments + assets - debt
  };
}

export async function getBucketBreakdown(): Promise<Record<BucketType, number>> {
  const [savings, investments, assets, debt] = await Promise.all([
    getBucketTotal('Savings'),
    getBucketTotal('Investments'),
    getBucketTotal('Assets'),
    getBucketTotal('Debt')
  ]);

  return {
    Savings: savings,
    Investments: investments,
    Assets: assets,
    Debt: debt
  };
}

// ============================================
// Portfolio Snapshot Operations
// ============================================

export async function getPortfolioSnapshots(options?: {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<DbPortfolioSnapshot[]> {
  let query = db.portfolioSnapshots.orderBy('date').reverse();

  if (options?.startDate && options?.endDate) {
    query = db.portfolioSnapshots
      .where('date')
      .between(options.startDate, options.endDate, true, true)
      .reverse();
  }

  let results = await query.toArray();

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

export async function getLatestPortfolioSnapshot(): Promise<DbPortfolioSnapshot | undefined> {
  return db.portfolioSnapshots.orderBy('date').last();
}

export async function createPortfolioSnapshot(): Promise<number> {
  const accounts = await db.portfolioAccounts.toArray();
  const items = await db.portfolioItems.filter(i => i.isActive).toArray();

  // Calculate bucket totals
  const bucketTotals: Record<BucketType, number> = {
    Savings: 0,
    Investments: 0,
    Assets: 0,
    Debt: 0
  };

  // Build account totals map
  const accountTotals = new Map<number, number>();

  for (const item of items) {
    const current = accountTotals.get(item.accountId) || 0;
    accountTotals.set(item.accountId, current + item.currentValue);
  }

  // Calculate bucket totals from accounts
  for (const account of accounts) {
    const total = accountTotals.get(account.id!) || 0;
    bucketTotals[account.bucket] += total;
  }

  const netWorth = bucketTotals.Savings + bucketTotals.Investments + bucketTotals.Assets - bucketTotals.Debt;

  // Build details
  const accountDetails = accounts.map(a => ({
    id: a.id!,
    bucket: a.bucket,
    name: a.name,
    total: accountTotals.get(a.id!) || 0
  }));

  const itemDetails = items.map(i => ({
    id: i.id!,
    accountId: i.accountId,
    name: i.name,
    value: i.currentValue
  }));

  return db.portfolioSnapshots.add({
    uuid: crypto.randomUUID(),
    date: new Date(),
    totalSavings: bucketTotals.Savings,
    totalInvestments: bucketTotals.Investments,
    totalAssets: bucketTotals.Assets,
    totalDebt: bucketTotals.Debt,
    netWorth,
    details: {
      accounts: accountDetails,
      items: itemDetails
    },
    createdAt: new Date()
  });
}

export async function deletePortfolioSnapshot(id: number): Promise<void> {
  await db.portfolioSnapshots.delete(id);
}

export async function getNetWorthChange(): Promise<{
  current: number;
  previous: number;
  change: number;
  changePercent: number;
} | null> {
  const snapshots = await db.portfolioSnapshots.orderBy('date').reverse().limit(2).toArray();

  if (snapshots.length === 0) {
    // No snapshots, calculate from current data
    const summary = await getNetWorthSummary();
    return {
      current: summary.netWorth,
      previous: summary.netWorth,
      change: 0,
      changePercent: 0
    };
  }

  const current = snapshots[0].netWorth;
  const previous = snapshots.length > 1 ? snapshots[1].netWorth : current;
  const change = current - previous;
  const changePercent = previous !== 0 ? (change / Math.abs(previous)) * 100 : 0;

  return { current, previous, change, changePercent };
}

// ============================================
// Initialize Database
// ============================================
// Ticker/Snapshot Helper Functions
// ============================================

// Get all active items that use ticker mode for price tracking
export async function getTickerModeItems(): Promise<DbPortfolioItem[]> {
  const items = await db.portfolioItems.filter(i => i.isActive && i.priceMode === 'ticker' && !!i.ticker).toArray();
  return items;
}

// Check if there's already a snapshot for today
export async function hasSnapshotToday(): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const snapshot = await db.portfolioSnapshots
    .where('date')
    .between(today, tomorrow, true, false)
    .first();

  return !!snapshot;
}

// Get today's snapshot if it exists
export async function getTodaySnapshot(): Promise<DbPortfolioSnapshot | undefined> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return db.portfolioSnapshots
    .where('date')
    .between(today, tomorrow, true, false)
    .first();
}

// ============================================

export async function initializeDatabase(): Promise<void> {
  await seedDefaultCategories();
}
