/**
 * Default Budget Hierarchy Seed (Drizzle client).
 *
 * Seeds the zero-based starter budget for new users. The hierarchy data itself
 * lives in ./budget-hierarchy-data (dependency-free so the raw data migration
 * can share it).
 *
 * See docs/budget-system-strategy.md → "Default Budget for New Users".
 */

import { db, schema } from "./connection";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { DEFAULT_BUDGET_CATEGORY_GROUPS } from "./budget-hierarchy-data";

export { DEFAULT_BUDGET_CATEGORY_GROUPS };
export type { SeedBudgetCategory, SeedBudgetCategoryGroup } from "./budget-hierarchy-data";

/**
 * Seed the default budget hierarchy for a user using the Drizzle client.
 *
 * @param userId    the owning user
 * @param withAmounts  when true, also inserts first-month `budgets` rows using
 *                     each item's `defaultAmount` (new users). When false, only
 *                     structure + keywords are seeded (existing users).
 * @param year/month   the period to seed amounts into (defaults to now).
 */
export async function seedDefaultBudgetForUser(
  userId: number,
  { withAmounts, year, month }: { withAmounts: boolean; year?: number; month?: number } = { withAmounts: true }
): Promise<void> {
  // Skip if the user already has a hierarchy.
  const existing = await db
    .select({ id: schema.budgetGroups.id })
    .from(schema.budgetGroups)
    .where(eq(schema.budgetGroups.userId, userId))
    .limit(1);
  if (existing.length > 0) return;

  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const targetMonth = month ?? now.getMonth();

  let groupOrder = 0;
  for (const group of DEFAULT_BUDGET_CATEGORY_GROUPS) {
    const groupRow = await db
      .insert(schema.budgetGroups)
      .values({ uuid: randomUUID(), name: group.name, order: groupOrder++, userId, createdAt: now, updatedAt: now })
      .returning({ id: schema.budgetGroups.id })
      .get();

    let categoryOrder = 0;
    for (const category of group.categories) {
      const categoryRow = await db
        .insert(schema.budgetSubcategories)
        .values({
          uuid: randomUUID(),
          name: category.name,
          groupId: groupRow.id,
          keywords: category.keywords,
          itemType: category.itemType ?? "expense",
          targetAmount: category.targetAmount ?? null,
          isActive: true,
          order: categoryOrder++,
          userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schema.budgetSubcategories.id })
        .get();

      if (withAmounts && category.defaultAmount > 0) {
        await db.insert(schema.budgets).values({
          budgetItemId: categoryRow.id,
          year: targetYear,
          month: targetMonth,
          amount: category.defaultAmount,
          userId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  console.log(`[Seed] Seeded default budget hierarchy for user ${userId} (amounts: ${withAmounts})`);
}
