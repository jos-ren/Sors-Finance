import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { SYSTEM_CATEGORIES, type BudgetItemType } from "@/lib/db/types";
import type { YearlySummary, YearlySummaryGroup, YearlySummaryCategory } from "@/lib/budget/types";

const zeros = () => new Array(12).fill(0) as number[];

// GET /api/budgets/yearly-summary?year= — powers the Yearly Totals view.
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const yearParam = request.nextUrl.searchParams.get("year");
    if (!yearParam) {
      return NextResponse.json({ error: "year is required", success: false }, { status: 400 });
    }
    const year = parseInt(yearParam, 10);
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const [groups, categories, budgetRows] = await Promise.all([
      db.select().from(schema.budgetGroups).where(eq(schema.budgetGroups.userId, userId)),
      db.select().from(schema.budgetSubcategories).where(eq(schema.budgetSubcategories.userId, userId)),
      db
        .select()
        .from(schema.budgets)
        .where(and(eq(schema.budgets.userId, userId), eq(schema.budgets.year, year))),
    ]);

    // planned[categoryId][month]
    const plannedByCategory = new Map<number, number[]>();
    for (const b of budgetRows) {
      if (!plannedByCategory.has(b.budgetItemId)) plannedByCategory.set(b.budgetItemId, zeros());
      if (b.month >= 0 && b.month < 12) plannedByCategory.get(b.budgetItemId)![b.month] += b.amount;
    }

    // actual[categoryId][month] from transactions in the year
    const txRows = await db
      .select({
        categoryId: schema.transactions.budgetItemId,
        date: schema.transactions.date,
        amountOut: schema.transactions.amountOut,
        amountIn: schema.transactions.amountIn,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          isNotNull(schema.transactions.budgetItemId),
          gte(schema.transactions.date, startDate),
          lte(schema.transactions.date, endDate)
        )
      );
    const actualByCategory = new Map<number, number[]>();
    for (const t of txRows) {
      if (t.categoryId === null) continue;
      if (!actualByCategory.has(t.categoryId)) actualByCategory.set(t.categoryId, zeros());
      const m = t.date.getMonth();
      actualByCategory.get(t.categoryId)![m] += t.amountOut - t.amountIn;
    }

    // Income by month
    const incomeByMonth = zeros();
    const incomeCat = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(and(eq(schema.categories.name, SYSTEM_CATEGORIES.INCOME), eq(schema.categories.userId, userId)))
      .limit(1);
    if (incomeCat[0]) {
      const incomeTx = await db
        .select({
          date: schema.transactions.date,
          amountOut: schema.transactions.amountOut,
          amountIn: schema.transactions.amountIn,
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
      for (const t of incomeTx) incomeByMonth[t.date.getMonth()] += t.amountIn - t.amountOut;
    }

    // Assemble
    const categoriesByGroup = new Map<number, typeof categories>();
    for (const c of categories) {
      if (!categoriesByGroup.has(c.groupId)) categoriesByGroup.set(c.groupId, []);
      categoriesByGroup.get(c.groupId)!.push(c);
    }

    const totalPlanned = zeros();
    const totalActual = zeros();

    const summaryGroups: YearlySummaryGroup[] = groups
      .sort((a, b) => a.order - b.order)
      .map((g) => {
        const summaryCategories: YearlySummaryCategory[] = (categoriesByGroup.get(g.id) ?? [])
          .sort((a, b) => a.order - b.order)
          .map((c) => {
            const plannedByMonth = plannedByCategory.get(c.id) ?? zeros();
            const actualByMonth = actualByCategory.get(c.id) ?? zeros();
            return {
              id: c.id,
              uuid: c.uuid,
              name: c.name,
              itemType: (c.itemType as BudgetItemType) ?? "expense",
              isActive: c.isActive,
              plannedByMonth,
              actualByMonth,
              plannedTotal: plannedByMonth.reduce((a, b) => a + b, 0),
              actualTotal: actualByMonth.reduce((a, b) => a + b, 0),
            } satisfies YearlySummaryCategory;
          })
          // Include active categories, or archived ones with any activity in the year.
          .filter((c) => c.isActive || c.plannedTotal !== 0 || c.actualTotal !== 0);

        for (const c of summaryCategories) {
          for (let m = 0; m < 12; m++) {
            totalPlanned[m] += c.plannedByMonth[m];
            totalActual[m] += c.actualByMonth[m];
          }
        }

        return { id: g.id, uuid: g.uuid, name: g.name, categories: summaryCategories } satisfies YearlySummaryGroup;
      })
      .filter((g) => g.categories.length > 0);

    const summary: YearlySummary = {
      year,
      groups: summaryGroups,
      incomeByMonth,
      plannedByMonth: totalPlanned,
      actualByMonth: totalActual,
    };

    return NextResponse.json({ data: summary, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/budgets/yearly-summary error:", error);
    return NextResponse.json({ error: "Failed to build yearly summary", success: false }, { status: 500 });
  }
}
