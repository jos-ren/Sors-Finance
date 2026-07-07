/**
 * Server-side goal (sinking fund) aggregation shared by /api/goals routes.
 *
 * Contributed = SUM(budgets.amount) across all months (monotonic up).
 * Spent = lifetime net transactions (amountOut − amountIn).
 * Available = contributed − spent.
 * Progress vs targetAmount is measured by contributed, never spend.
 */

import { db, schema } from "@/lib/db/connection";
import { eq, and, sql, isNotNull, asc } from "drizzle-orm";
import type { GoalSummary } from "@/lib/budget/types";

/** year/month identify the "current" period (0-based month) for
 *  thisMonthContributed and pace — passed from the client per convention. */
export async function getGoalSummaries(userId: number, year: number, month: number): Promise<GoalSummary[]> {
  const goals = await db
    .select({
      id: schema.budgetSubcategories.id,
      uuid: schema.budgetSubcategories.uuid,
      name: schema.budgetSubcategories.name,
      groupId: schema.budgetSubcategories.groupId,
      groupName: schema.budgetGroups.name,
      isActive: schema.budgetSubcategories.isActive,
      targetAmount: schema.budgetSubcategories.targetAmount,
      targetDate: schema.budgetSubcategories.targetDate,
    })
    .from(schema.budgetSubcategories)
    .innerJoin(schema.budgetGroups, eq(schema.budgetSubcategories.groupId, schema.budgetGroups.id))
    .where(
      and(eq(schema.budgetSubcategories.userId, userId), eq(schema.budgetSubcategories.itemType, "goal"))
    )
    .orderBy(asc(schema.budgetSubcategories.order));

  if (goals.length === 0) return [];

  const [contributedRows, spentRows, thisMonthRows] = await Promise.all([
    // Lifetime allocations per goal
    db
      .select({
        categoryId: schema.budgets.budgetItemId,
        total: sql<number>`SUM(${schema.budgets.amount})`,
      })
      .from(schema.budgets)
      .where(eq(schema.budgets.userId, userId))
      .groupBy(schema.budgets.budgetItemId),
    // Lifetime net transactions per goal
    db
      .select({
        categoryId: schema.transactions.budgetItemId,
        total: sql<number>`SUM(${schema.transactions.amountOut}) - SUM(${schema.transactions.amountIn})`,
      })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), isNotNull(schema.transactions.budgetItemId)))
      .groupBy(schema.transactions.budgetItemId),
    // Current period's allocation per goal
    db
      .select({
        categoryId: schema.budgets.budgetItemId,
        amount: schema.budgets.amount,
      })
      .from(schema.budgets)
      .where(
        and(eq(schema.budgets.userId, userId), eq(schema.budgets.year, year), eq(schema.budgets.month, month))
      ),
  ]);

  const contributedBy = new Map<number, number>();
  for (const r of contributedRows) contributedBy.set(r.categoryId, r.total ?? 0);
  const spentBy = new Map<number, number>();
  for (const r of spentRows) if (r.categoryId !== null) spentBy.set(r.categoryId, r.total ?? 0);
  const thisMonthBy = new Map<number, number>();
  for (const r of thisMonthRows) thisMonthBy.set(r.categoryId, r.amount);

  return goals.map((g) => {
    const contributed = contributedBy.get(g.id) ?? 0;
    const spent = spentBy.get(g.id) ?? 0;
    const targetAmount = g.targetAmount ?? null;
    const targetDate = g.targetDate ? g.targetDate.getTime() : null;

    let monthsRemaining: number | null = null;
    let requiredPerMonth: number | null = null;
    if (g.targetDate) {
      monthsRemaining =
        (g.targetDate.getFullYear() - year) * 12 + (g.targetDate.getMonth() - month);
      if (targetAmount != null && monthsRemaining > 0) {
        requiredPerMonth = Math.max(0, (targetAmount - contributed) / monthsRemaining);
      }
    }

    return {
      id: g.id,
      uuid: g.uuid,
      name: g.name,
      groupId: g.groupId,
      groupName: g.groupName,
      isActive: g.isActive,
      targetAmount,
      targetDate,
      contributed,
      spent,
      available: contributed - spent,
      thisMonthContributed: thisMonthBy.get(g.id) ?? 0,
      isComplete: targetAmount != null && targetAmount > 0 && contributed >= targetAmount,
      monthsRemaining,
      requiredPerMonth,
    } satisfies GoalSummary;
  });
}
