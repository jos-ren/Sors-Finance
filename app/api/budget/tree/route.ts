import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, gte, lte, sql, isNotNull } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { SYSTEM_CATEGORIES, type BudgetItemType } from "@/lib/db/types";
import type { BudgetTree, BudgetTreeGroup, BudgetTreeCategory } from "@/lib/budget/types";

// GET /api/budget/tree?year=&month=
// The one nested endpoint the budget page consumes: groups→categories with
// planned/actual rollups, per-category budgetId/planned/actual/cumulative,
// plus a zero-based summary. Archived categories are included only when they
// have activity (a budget row or transactions) in the period.
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const yearParam = request.nextUrl.searchParams.get("year");
    const monthParam = request.nextUrl.searchParams.get("month");
    if (yearParam === null || monthParam === null) {
      return NextResponse.json({ error: "year and month are required", success: false }, { status: 400 });
    }
    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10);
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    // Hierarchy (all categories incl. archived; we filter archived-without-activity below)
    const [groups, categories] = await Promise.all([
      db.select().from(schema.budgetGroups).where(eq(schema.budgetGroups.userId, userId)),
      db.select().from(schema.budgetSubcategories).where(eq(schema.budgetSubcategories.userId, userId)),
    ]);

    // Budgets for the period → categoryId → { id, amount }
    const budgetRows = await db
      .select()
      .from(schema.budgets)
      .where(
        and(
          eq(schema.budgets.userId, userId),
          eq(schema.budgets.year, year),
          eq(schema.budgets.month, month)
        )
      );
    const budgetByCategory = new Map<number, { id: number; amount: number }>();
    for (const b of budgetRows) budgetByCategory.set(b.budgetItemId, { id: b.id, amount: b.amount });

    // Actual (net spending) per category for the period
    const monthActuals = await db
      .select({
        categoryId: schema.transactions.budgetItemId,
        total: sql<number>`SUM(${schema.transactions.amountOut}) - SUM(${schema.transactions.amountIn})`,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          isNotNull(schema.transactions.budgetItemId),
          gte(schema.transactions.date, startDate),
          lte(schema.transactions.date, endDate)
        )
      )
      .groupBy(schema.transactions.budgetItemId);
    const actualByCategory = new Map<number, number>();
    for (const r of monthActuals) if (r.categoryId !== null) actualByCategory.set(r.categoryId, r.total ?? 0);

    // Lifetime net per category (for goal cumulative)
    const lifetimeActuals = await db
      .select({
        categoryId: schema.transactions.budgetItemId,
        total: sql<number>`SUM(${schema.transactions.amountOut}) - SUM(${schema.transactions.amountIn})`,
      })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), isNotNull(schema.transactions.budgetItemId)))
      .groupBy(schema.transactions.budgetItemId);
    const cumulativeByCategory = new Map<number, number>();
    for (const r of lifetimeActuals) if (r.categoryId !== null) cumulativeByCategory.set(r.categoryId, r.total ?? 0);

    // Income actual for the period (Income system category, net inflow)
    const incomeCat = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(and(eq(schema.categories.name, SYSTEM_CATEGORIES.INCOME), eq(schema.categories.userId, userId)))
      .limit(1);
    let incomeActual = 0;
    if (incomeCat[0]) {
      const incomeRows = await db
        .select({
          total: sql<number>`SUM(${schema.transactions.amountIn}) - SUM(${schema.transactions.amountOut})`,
        })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, userId),
            eq(schema.transactions.categoryId, incomeCat[0].id),
            gte(schema.transactions.date, startDate),
            lte(schema.transactions.date, endDate)
          )
        );
      incomeActual = incomeRows[0]?.total ?? 0;
    }

    // Assemble the tree.
    const categoriesByGroup = new Map<number, typeof categories>();
    for (const c of categories) {
      if (!categoriesByGroup.has(c.groupId)) categoriesByGroup.set(c.groupId, []);
      categoriesByGroup.get(c.groupId)!.push(c);
    }

    let totalBudgeted = 0;
    let totalActual = 0;

    const treeGroups: BudgetTreeGroup[] = groups
      .sort((a, b) => a.order - b.order)
      .map((g) => {
        const treeCategories: BudgetTreeCategory[] = (categoriesByGroup.get(g.id) ?? [])
          .sort((a, b) => a.order - b.order)
          .map((c) => {
            const budget = budgetByCategory.get(c.id);
            const planned = budget?.amount ?? 0;
            const actual = actualByCategory.get(c.id) ?? 0;
            const itemType = (c.itemType as BudgetItemType) ?? "expense";
            return {
              id: c.id,
              uuid: c.uuid,
              name: c.name,
              order: c.order,
              itemType,
              targetAmount: c.targetAmount ?? null,
              isActive: c.isActive,
              keywords: c.keywords ?? [],
              budgetId: budget?.id ?? null,
              planned,
              actual,
              cumulative: itemType === "goal" ? cumulativeByCategory.get(c.id) ?? 0 : 0,
            } satisfies BudgetTreeCategory;
          })
          // Drop archived categories that have no activity this period.
          .filter((c) => c.isActive || c.planned !== 0 || c.actual !== 0);

        for (const c of treeCategories) {
          totalBudgeted += c.planned;
          totalActual += c.actual;
        }

        return {
          id: g.id,
          uuid: g.uuid,
          name: g.name,
          order: g.order,
          planned: treeCategories.reduce((a, c) => a + c.planned, 0),
          actual: treeCategories.reduce((a, c) => a + c.actual, 0),
          categories: treeCategories,
        } satisfies BudgetTreeGroup;
      })
      // Keep groups that still have visible categories.
      .filter((g) => g.categories.length > 0);

    const tree: BudgetTree = {
      year,
      month,
      groups: treeGroups,
      summary: {
        incomeActual,
        totalBudgeted,
        totalActual,
        availableToAssign: incomeActual - totalBudgeted,
      },
    };

    return NextResponse.json({ data: tree, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/budget/tree error:", error);
    return NextResponse.json({ error: "Failed to build budget tree", success: false }, { status: 500 });
  }
}
