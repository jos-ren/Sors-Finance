/**
 * Database Seeding
 *
 * Default categories and initialization logic for SQLite/Drizzle.
 */

import { db, schema } from "./connection";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { SYSTEM_CATEGORIES } from "./types";

// System categories (always created first, cannot be deleted)
const SYSTEM_CATEGORY_DEFS = [
  { name: SYSTEM_CATEGORIES.UNCATEGORIZED, keywords: [], isSystem: true },
  { name: SYSTEM_CATEGORIES.EXCLUDED, keywords: [], isSystem: true },
  { name: SYSTEM_CATEGORIES.INCOME, keywords: ["SALARY", "PAYROLL", "DEPOSIT", "DIRECT DEP", "VENMO", "ZELLE", "ACH CREDIT"], isSystem: true },
];

const DEFAULT_CATEGORIES = [
  { name: "Groceries", keywords: ["WHOLE FOODS", "TRADER JOE", "KROGER", "WALMART", "COSTCO", "SAFEWAY", "PUBLIX", "ALDI"] },
  { name: "Dining & Restaurants", keywords: ["RESTAURANT", "MCDONALD", "STARBUCKS", "CHIPOTLE", "DOORDASH", "UBER EATS", "GRUBHUB", "CHEESECAKE"] },
  { name: "Gas & Transportation", keywords: ["CHEVRON", "EXXON", "SHELL", "BP", "UBER", "LYFT", "METRO TRANSIT"] },
  { name: "Subscriptions", keywords: ["NETFLIX", "SPOTIFY", "DISNEY", "AMAZON PRIME", "APPLE.COM", "HULU", "HBO MAX", "GOOGLE"] },
  { name: "Shopping", keywords: ["AMAZON", "AMZN MKTP", "TARGET", "BEST BUY", "HOME DEPOT", "LOWES", "IKEA", "NORDSTROM"] },
  { name: "Utilities & Bills", keywords: ["VERIZON", "AT&T", "T-MOBILE", "COMCAST", "XFINITY", "PG&E", "INSURANCE", "SPECTRUM"] },
  { name: "Healthcare", keywords: ["CVS", "WALGREENS", "PHARMACY", "MEDICAL", "DENTAL", "CLINIC", "HOSPITAL"] },
];

export { DEFAULT_CATEGORIES };

/**
 * Seed default categories for a specific user.
 * This should be called when a new user registers.
 */
export async function seedDefaultCategoriesForUser(userId: number): Promise<void> {
  // Check if user already has categories
  const existingCategories = await db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.userId, userId));

  if (existingCategories.length > 0) {
    // User already has categories, ensure system categories exist
    await ensureSystemCategoriesForUser(userId, existingCategories);
    return;
  }

  const now = new Date();
  let order = 0;

  // Add system categories first
  for (const cat of SYSTEM_CATEGORY_DEFS) {
    await db.insert(schema.categories).values({
      uuid: randomUUID(),
      name: cat.name,
      keywords: cat.keywords,
      order: order++,
      isSystem: cat.isSystem,
      userId,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Add default user categories
  for (const cat of DEFAULT_CATEGORIES) {
    await db.insert(schema.categories).values({
      uuid: randomUUID(),
      name: cat.name,
      keywords: cat.keywords,
      order: order++,
      isSystem: false,
      userId,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`[Seed] Seeded default categories for user ${userId}`);
}

// Ensure system categories exist for a user (for database migrations)
async function ensureSystemCategoriesForUser(
  userId: number,
  existingCategories: typeof schema.categories.$inferSelect[]
): Promise<void> {
  const now = new Date();

  for (const sysCat of SYSTEM_CATEGORY_DEFS) {
    const exists = existingCategories.find(c => c.name === sysCat.name);
    if (!exists) {
      // Add missing system category at the beginning
      await db.insert(schema.categories).values({
        uuid: randomUUID(),
        name: sysCat.name,
        keywords: sysCat.keywords,
        order: -1, // Will be at the top
        isSystem: true,
        userId,
        createdAt: now,
        updatedAt: now,
      });
    } else if (!exists.isSystem) {
      // Mark existing category as system
      await db
        .update(schema.categories)
        .set({ isSystem: true, updatedAt: now })
        .where(eq(schema.categories.id, exists.id));
    }
  }
}

// Legacy function for backwards compatibility (seeds for null userId / global categories)
export async function seedDefaultCategories(): Promise<void> {
  const existingCategories = await db.select().from(schema.categories);

  if (existingCategories.length > 0) {
    // Ensure system categories exist even for existing databases
    await ensureSystemCategories(existingCategories);
    return;
  }

  const now = new Date();
  let order = 0;

  // Add system categories first
  for (const cat of SYSTEM_CATEGORY_DEFS) {
    await db.insert(schema.categories).values({
      uuid: randomUUID(),
      name: cat.name,
      keywords: cat.keywords,
      order: order++,
      isSystem: cat.isSystem,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Add default user categories
  for (const cat of DEFAULT_CATEGORIES) {
    await db.insert(schema.categories).values({
      uuid: randomUUID(),
      name: cat.name,
      keywords: cat.keywords,
      order: order++,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log("[Seed] Seeded default categories");
}

// Ensure system categories exist (for database migrations) - legacy version
async function ensureSystemCategories(existingCategories: typeof schema.categories.$inferSelect[]): Promise<void> {
  const now = new Date();

  for (const sysCat of SYSTEM_CATEGORY_DEFS) {
    const exists = existingCategories.find(c => c.name === sysCat.name);
    if (!exists) {
      // Add missing system category at the beginning
      await db.insert(schema.categories).values({
        uuid: randomUUID(),
        name: sysCat.name,
        keywords: sysCat.keywords,
        order: -1, // Will be at the top
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      });
    } else if (!exists.isSystem) {
      // Mark existing category as system
      await db
        .update(schema.categories)
        .set({ isSystem: true, updatedAt: now })
        .where(eq(schema.categories.id, exists.id));
    }
  }
}

/**
 * Seed default settings for a specific user.
 * This should be called when a new user registers.
 */
export async function seedDefaultSettingsForUser(userId: number): Promise<void> {
  const now = new Date();

  // Default settings to seed
  const defaultSettings = [
    { key: "CURRENCY", value: "USD" },
    { key: "autoCopyBudgets", value: "false" },
    // Note: TIMEZONE and FINNHUB_API_KEY are not seeded
    // TIMEZONE will be set from the client's browser on first load
    // FINNHUB_API_KEY starts as null (user must configure it)
  ];

  for (const setting of defaultSettings) {
    // Check if setting already exists for this user
    const existing = await db
      .select()
      .from(schema.settings)
      .where(and(
        eq(schema.settings.key, setting.key),
        eq(schema.settings.userId, userId)
      ))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(schema.settings).values({
        key: setting.key,
        value: setting.value,
        userId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  console.log(`[Seed] Seeded default settings for user ${userId}`);
}

export async function initializeDatabase(): Promise<void> {
  await seedDefaultCategories();
}
