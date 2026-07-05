import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, gte, lte, sql, isNotNull } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { SYSTEM_CATEGORIES, type BudgetItemType } from "@/lib/db/types";
import type { BudgetTree, BudgetTreeGroup, BudgetTreeItem, BudgetTreeSubcategory } from "@/lib/budget/types";

// GET /api/budget/tree?year=&month=
// The one nested endpoint the budget page consumes: groups→subs→items with
// planned/actual rollups, per-item budgetId/planned/actual/cumulative, plus a
// zero-based summary. Archived items are included only when they have activity
// (a budget row or transactions) in the period.
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

    // Hierarchy (all items incl. archived; we filter archived-without-activity below)
    const [groups, subcategories, items] = await Promise.all([
      db.select().from(schema.budgetGroups).where(eq(schema.budgetGroups.userId, userId)),
      db.select().from(schema.budgetSubcategories).where(eq(schema.budgetSubcategories.userId, userId)),
      db.select().from(schema.budgetItems).where(eq(schema.budgetItems.userId, userId)),
    ]);

    // Budgets for the period → itemId → { id, amount }
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
    const budgetByItem = new Map<number, { id: number; amount: number }>();
    for (const b of budgetRows) budgetByItem.set(b.budgetItemId, { id: b.id, amount: b.amount });

    // Actual (net spending) per item for the period
    const monthActuals = await db
      .select({
        itemId: schema.transactions.budgetItemId,
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
    const actualByItem = new Map<number, number>();
    for (const r of monthActuals) if (r.itemId !== null) actualByItem.set(r.itemId, r.total ?? 0);

    // Lifetime net per item (for goal cumulative)
    const lifetimeActuals = await db
      .select({
        itemId: schema.transactions.budgetItemId,
        total: sql<number>`SUM(${schema.transactions.amountOut}) - SUM(${schema.transactions.amountIn})`,
      })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), isNotNull(schema.transactions.budgetItemId)))
      .groupBy(schema.transactions.budgetItemId);
    const cumulativeByItem = new Map<number, number>();
    for (const r of lifetimeActuals) if (r.itemId !== null) cumulativeByItem.set(r.itemId, r.total ?? 0);

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
    const subsByGroup = new Map<number, typeof subcategories>();
    for (const s of subcategories) {
      if (!subsByGroup.has(s.groupId)) subsByGroup.set(s.groupId, []);
      subsByGroup.get(s.groupId)!.push(s);
    }
    const itemsBySub = new Map<number, typeof items>();
    for (const i of items) {
      if (!itemsBySub.has(i.subcategoryId)) itemsBySub.set(i.subcategoryId, []);
      itemsBySub.get(i.subcategoryId)!.push(i);
    }

    let totalBudgeted = 0;
    let totalActual = 0;

    const treeGroups: BudgetTreeGroup[] = groups
      .sort((a, b) => a.order - b.order)
      .map((g) => {
        const treeSubs: BudgetTreeSubcategory[] = (subsByGroup.get(g.id) ?? [])
          .sort((a, b) => a.order - b.order)
          .map((s) => {
            const treeItems: BudgetTreeItem[] = (itemsBySub.get(s.id) ?? [])
              .sort((a, b) => a.order - b.order)
              .map((it) => {
                const budget = budgetByItem.get(it.id);
                const planned = budget?.amount ?? 0;
                const actual = actualByItem.get(it.id) ?? 0;
                const itemType = (it.itemType as BudgetItemType) ?? "expense";
                return {
                  id: it.id,
                  uuid: it.uuid,
                  name: it.name,
                  order: it.order,
                  itemType,
                  targetAmount: it.targetAmount ?? null,
                  isActive: it.isActive,
                  keywords: it.keywords ?? [],
                  budgetId: budget?.id ?? null,
                  planned,
                  actual,
                  cumulative: itemType === "goal" ? cumulativeByItem.get(it.id) ?? 0 : 0,
                } satisfies BudgetTreeItem;
              })
              // Drop archived items that have no activity this period.
              .filter((it) => it.isActive || it.planned !== 0 || it.actual !== 0);

            for (const it of treeItems) {
              totalBudgeted += it.planned;
              totalActual += it.actual;
            }

            return {
              id: s.id,
              uuid: s.uuid,
              name: s.name,
              order: s.order,
              planned: treeItems.reduce((a, i) => a + i.planned, 0),
              actual: treeItems.reduce((a, i) => a + i.actual, 0),
              items: treeItems,
            } satisfies BudgetTreeSubcategory;
          })
          // Keep subcategories that still have visible items.
          .filter((s) => s.items.length > 0);

        return {
          id: g.id,
          uuid: g.uuid,
          name: g.name,
          order: g.order,
          planned: treeSubs.reduce((a, s) => a + s.planned, 0),
          actual: treeSubs.reduce((a, s) => a + s.actual, 0),
          subcategories: treeSubs,
        } satisfies BudgetTreeGroup;
      })
      // Keep groups that still have visible subcategories.
      .filter((g) => g.subcategories.length > 0);

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
