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
  isSystem?: boolean;     // System categories (Ignore, Uncategorized) cannot be deleted
  createdAt: Date;
  updatedAt: Date;
}

// System category names
export const SYSTEM_CATEGORIES = {
  IGNORE: 'Ignore',
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
// Database Class
// ============================================

class SorsDatabase extends Dexie {
  categories!: Table<DbCategory>;
  transactions!: Table<DbTransaction>;
  budgets!: Table<DbBudget>;
  imports!: Table<DbImport>;
  settings!: Table<DbSettings>;

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

  // Get the Ignore category to exclude from calculations
  const ignoreCategory = await getIgnoreCategory();
  const ignoreCategoryId = ignoreCategory?.id;

  const transactions = await db.transactions
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();

  const spending = new Map<number, number>();

  for (const t of transactions) {
    // Exclude ignored transactions from calculations
    if (t.categoryId !== null && t.categoryId !== ignoreCategoryId && t.amountOut > 0) {
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

  // Get the Ignore category to exclude from calculations
  const ignoreCategory = await getIgnoreCategory();
  const ignoreCategoryId = ignoreCategory?.id;

  const transactions = await db.transactions
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();

  let income = 0;
  let expenses = 0;

  for (const t of transactions) {
    // Exclude ignored transactions from calculations
    if (t.categoryId !== ignoreCategoryId) {
      income += t.amountIn;
      expenses += t.amountOut;
    }
  }

  return { income, expenses };
}

// ============================================
// Default Data Seeding
// ============================================

// System categories (always created first, cannot be deleted)
const SYSTEM_CATEGORY_DEFS = [
  { name: SYSTEM_CATEGORIES.UNCATEGORIZED, keywords: [], isSystem: true },
  { name: SYSTEM_CATEGORIES.IGNORE, keywords: [], isSystem: true },
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

// Get the Ignore category (for excluding from calculations)
export async function getIgnoreCategory(): Promise<DbCategory | undefined> {
  return db.categories.where('name').equals(SYSTEM_CATEGORIES.IGNORE).first();
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
// Initialize Database
// ============================================

export async function initializeDatabase(): Promise<void> {
  await seedDefaultCategories();
}
