/**
 * Database Seeding
 *
 * Default categories and initialization logic.
 */

import { db } from "./instance";
import { SYSTEM_CATEGORIES } from "./types";

// System categories (always created first, cannot be deleted)
const SYSTEM_CATEGORY_DEFS = [
  { name: SYSTEM_CATEGORIES.UNCATEGORIZED, keywords: [], isSystem: true },
  { name: SYSTEM_CATEGORIES.EXCLUDED, keywords: [], isSystem: true },
  { name: SYSTEM_CATEGORIES.INCOME, keywords: ["SALARY", "PAYROLL", "DEPOSIT", "DIRECT DEP", "E-TRANSFER IN"], isSystem: true },
];

const DEFAULT_CATEGORIES = [
  { name: "Groceries", keywords: ["LOBLAWS", "METRO", "SOBEYS", "FARM BOY", "WALMART", "COSTCO"] },
  { name: "Dining & Restaurants", keywords: ["RESTAURANT", "MCDONALD", "TIM HORTONS", "STARBUCKS", "SUBWAY", "PIZZA"] },
  { name: "Gas & Transportation", keywords: ["SHELL", "ESSO", "PETRO", "CANADIAN TIRE GAS", "UBER", "LYFT", "PRESTO"] },
  { name: "Subscriptions", keywords: ["NETFLIX", "SPOTIFY", "DISNEY", "AMAZON PRIME", "APPLE.COM", "GOOGLE"] },
  { name: "Shopping", keywords: ["AMAZON", "AMZN MKTP", "BEST BUY", "HOME DEPOT", "IKEA"] },
  { name: "Utilities & Bills", keywords: ["ROGERS", "BELL", "TELUS", "HYDRO", "ENBRIDGE", "INSURANCE"] },
  { name: "Healthcare", keywords: ["PHARMACY", "SHOPPERS", "REXALL", "MEDICAL", "DENTAL", "CLINIC"] },
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
      updatedAt: now,
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
      updatedAt: now,
    });
  }
  console.log("Seeded default categories");
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
        updatedAt: now,
      });
    } else if (!exists.isSystem) {
      // Mark existing category as system
      await db.categories.update(exists.id!, { isSystem: true, updatedAt: now });
    }
  }
}

export async function initializeDatabase(): Promise<void> {
  await seedDefaultCategories();
}
