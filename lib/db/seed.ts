/**
 * Database Seeding
 *
 * Default categories and initialization logic for SQLite/Drizzle.
 */

import { db, schema } from "./connection";
import { eq } from "drizzle-orm";
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

// Ensure system categories exist (for database migrations)
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

export async function initializeDatabase(): Promise<void> {
  await seedDefaultCategories();
}
