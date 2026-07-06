/**
 * Database Seeding
 *
 * System categories, default budget hierarchy, and initialization logic.
 *
 * The flat user-category seed is gone: budgeting now uses the 3-level hierarchy
 * (see ./budget-seed). Only the three system categories (Income / Excluded /
 * Uncategorized) live in the `categories` table.
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

/**
 * Seed system categories for a specific user.
 * Called when a new user registers (budget hierarchy is seeded separately via
 * seedDefaultBudgetForUser).
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

  // Add system categories only
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

  console.log(`[Seed] Seeded system categories for user ${userId}`);
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

  // Add system categories only
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

  console.log("[Seed] Seeded system categories");
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

/** Fallback when the client doesn't report a usable timezone */
const DEFAULT_TIMEZONE = "America/Los_Angeles";

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure the user has a TIMEZONE setting, seeding it from the client's
 * browser timezone (or PST fallback) if missing. Called on first
 * authenticated app load; once the user changes the setting in Settings,
 * that value is authoritative and this never overwrites it.
 *
 * Returns true if a timezone was seeded, false if one already existed.
 */
export async function ensureTimezoneSetting(
  userId: number,
  clientTimezone?: string
): Promise<boolean> {
  const existing = await db
    .select()
    .from(schema.settings)
    .where(and(
      eq(schema.settings.key, "TIMEZONE"),
      eq(schema.settings.userId, userId)
    ))
    .limit(1);

  if (existing.length > 0) return false;

  const timezone =
    clientTimezone && isValidTimezone(clientTimezone)
      ? clientTimezone
      : DEFAULT_TIMEZONE;

  await db.insert(schema.settings).values({
    key: "TIMEZONE",
    value: timezone,
    userId,
  });

  console.log(`[Seed] Set timezone for user ${userId}: ${timezone}`);
  return true;
}

/**
 * Seed default settings for a specific user.
 * This should be called when a new user registers.
 */
export async function seedDefaultSettingsForUser(userId: number): Promise<void> {
  // Default settings to seed
  const defaultSettings = [
    { key: "CURRENCY", value: "USD" },
    { key: "autoCopyBudgets", value: "false" },
    // Note: TIMEZONE and FINNHUB_API_KEY are not seeded here.
    // TIMEZONE is seeded from the browser on first authenticated app load.
    // FINNHUB_API_KEY starts as null (user must configure it).
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
      });
    }
  }

  console.log(`[Seed] Seeded default settings for user ${userId}`);
}

export async function initializeDatabase(): Promise<void> {
  await seedDefaultCategories();
}
