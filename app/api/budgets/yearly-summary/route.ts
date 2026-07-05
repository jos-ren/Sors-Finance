import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { SYSTEM_CATEGORIES, type BudgetItemType } from "@/lib/db/types";
import type {
  YearlySummary,
  YearlySummaryGroup,
  YearlySummaryItem,
  YearlySummarySubcategory,
} from "@/lib/budget/types";

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

    const [groups, subcategories, items, budgetRows] = await Promise.all([
      db.select().from(schema.budgetGroups).where(eq(schema.budgetGroups.userId, userId)),
      db.select().from(schema.budgetSubcategories).where(eq(schema.budgetSubcategories.userId, userId)),
      db.select().from(schema.budgetItems).where(eq(schema.budgetItems.userId, userId)),
      db
        .select()
        .from(schema.budgets)
        .where(and(eq(schema.budgets.userId, userId), eq(schema.budgets.year, year))),
    ]);

    // planned[itemId][month]
    const plannedByItem = new Map<number, number[]>();
    for (const b of budgetRows) {
      if (!plannedByItem.has(b.budgetItemId)) plannedByItem.set(b.budgetItemId, zeros());
      if (b.month >= 0 && b.month < 12) plannedByItem.get(b.budgetItemId)![b.month] += b.amount;
    }

    // actual[itemId][month] from transactions in the year
    const txRows = await db
      .select({
        itemId: schema.transactions.budgetItemId,
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
    const actualByItem = new Map<number, number[]>();
    for (const t of txRows) {
      if (t.itemId === null) continue;
      if (!actualByItem.has(t.itemId)) actualByItem.set(t.itemId, zeros());
      const m = t.date.getMonth();
      actualByItem.get(t.itemId)![m] += t.amountOut - t.amountIn;
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

    const totalPlanned = zeros();
    const totalActual = zeros();

    const summaryGroups: YearlySummaryGroup[] = groups
      .sort((a, b) => a.order - b.order)
      .map((g) => {
        const subs: YearlySummarySubcategory[] = (subsByGroup.get(g.id) ?? [])
          .sort((a, b) => a.order - b.order)
          .map((s) => {
            const summaryItems: YearlySummaryItem[] = (itemsBySub.get(s.id) ?? [])
              .sort((a, b) => a.order - b.order)
              .map((it) => {
                const plannedByMonth = plannedByItem.get(it.id) ?? zeros();
                const actualByMonth = actualByItem.get(it.id) ?? zeros();
                return {
                  id: it.id,
                  uuid: it.uuid,
                  name: it.name,
                  itemType: (it.itemType as BudgetItemType) ?? "expense",
                  isActive: it.isActive,
                  plannedByMonth,
                  actualByMonth,
                  plannedTotal: plannedByMonth.reduce((a, b) => a + b, 0),
                  actualTotal: actualByMonth.reduce((a, b) => a + b, 0),
                } satisfies YearlySummaryItem;
              })
              // Include active items, or archived items with any activity in the year.
              .filter((it) => it.isActive || it.plannedTotal !== 0 || it.actualTotal !== 0);

            for (const it of summaryItems) {
              for (let m = 0; m < 12; m++) {
                totalPlanned[m] += it.plannedByMonth[m];
                totalActual[m] += it.actualByMonth[m];
              }
            }

            return { id: s.id, uuid: s.uuid, name: s.name, items: summaryItems } satisfies YearlySummarySubcategory;
          })
          .filter((s) => s.items.length > 0);

        return { id: g.id, uuid: g.uuid, name: g.name, subcategories: subs } satisfies YearlySummaryGroup;
      })
      .filter((g) => g.subcategories.length > 0);

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
