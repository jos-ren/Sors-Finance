import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, gte, lte, ne, sql, isNotNull } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { SYSTEM_CATEGORIES } from "@/lib/db/types";

// GET /api/transactions/aggregations?type=spending&year=2024&month=1
//
// Spending aggregations now group by budget_item_id (the hierarchy leaf) and
// return the same Record<itemId, number> shape the dashboard already consumes.
// The Excluded pre-filter (system category) is unchanged. New types: incomeTotal
// and goalProgress.
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "spending";
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    // System category ids for this user (used for filtering / income).
    const sysCats = await db
      .select({ id: schema.categories.id, name: schema.categories.name })
      .from(schema.categories)
      .where(and(eq(schema.categories.isSystem, true), eq(schema.categories.userId, userId)));
    const excludedId = sysCats.find((c) => c.name === SYSTEM_CATEGORIES.EXCLUDED)?.id;
    const incomeId = sysCats.find((c) => c.name === SYSTEM_CATEGORIES.INCOME)?.id;

    // Reusable Excluded pre-filter for the income/expense totals & trends.
    const excludeFilter = () => (excludedId ? [ne(schema.transactions.categoryId, excludedId)] : []);

    const periodRange = (): [Date, Date] => {
      const yearNum = parseInt(year!, 10);
      if (month) {
        const monthNum = parseInt(month, 10);
        return [new Date(yearNum, monthNum, 1), new Date(yearNum, monthNum + 1, 0, 23, 59, 59)];
      }
      return [new Date(yearNum, 0, 1), new Date(yearNum, 11, 31, 23, 59, 59)];
    };

    // Spending grouped by budget item over a date range → Record<itemId, number>
    const spendingByItem = async (startDate: Date, endDate: Date) => {
      const results = await db
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
      const map: Record<number, number> = {};
      for (const r of results) if (r.itemId !== null) map[r.itemId] = r.total || 0;
      return map;
    };

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    switch (type) {
      case "spending": {
        if (!year) return NextResponse.json({ error: "Year is required", success: false }, { status: 400 });
        const [startDate, endDate] = periodRange();
        return NextResponse.json({ data: await spendingByItem(startDate, endDate), success: true });
      }

      case "ytdSpending": {
        if (!year) return NextResponse.json({ error: "Year is required", success: false }, { status: 400 });
        const yearNum = parseInt(year, 10);
        const now = new Date();
        const startDate = new Date(yearNum, 0, 1);
        const endDate = yearNum === now.getFullYear() ? now : new Date(yearNum, 11, 31, 23, 59, 59);
        return NextResponse.json({ data: await spendingByItem(startDate, endDate), success: true });
      }

      case "allTimeByCategory": {
        const results = await db
          .select({
            itemId: schema.transactions.budgetItemId,
            total: sql<number>`SUM(${schema.transactions.amountOut}) - SUM(${schema.transactions.amountIn})`,
          })
          .from(schema.transactions)
          .where(and(eq(schema.transactions.userId, userId), isNotNull(schema.transactions.budgetItemId)))
          .groupBy(schema.transactions.budgetItemId);
        const map: Record<number, number> = {};
        for (const r of results) if (r.itemId !== null) map[r.itemId] = r.total || 0;
        return NextResponse.json({ data: map, success: true });
      }

      case "totals": {
        if (!year) return NextResponse.json({ error: "Year is required", success: false }, { status: 400 });
        const [startDate, endDate] = periodRange();
        const results = await db
          .select({
            income: sql<number>`SUM(${schema.transactions.amountIn})`,
            expenses: sql<number>`SUM(${schema.transactions.amountOut})`,
          })
          .from(schema.transactions)
          .where(
            and(
              eq(schema.transactions.userId, userId),
              gte(schema.transactions.date, startDate),
              lte(schema.transactions.date, endDate),
              ...excludeFilter()
            )
          );
        return NextResponse.json({
          data: { income: results[0]?.income || 0, expenses: results[0]?.expenses || 0 },
          success: true,
        });
      }

      case "allTimeTotals": {
        const results = await db
          .select({
            income: sql<number>`SUM(${schema.transactions.amountIn})`,
            expenses: sql<number>`SUM(${schema.transactions.amountOut})`,
          })
          .from(schema.transactions)
          .where(and(eq(schema.transactions.userId, userId), ...excludeFilter()));
        return NextResponse.json({
          data: { income: results[0]?.income || 0, expenses: results[0]?.expenses || 0 },
          success: true,
        });
      }

      case "incomeTotal": {
        // Net income (Income system category) for a period, or all-time if no year.
        if (!incomeId) return NextResponse.json({ data: 0, success: true });
        const conditions = [
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.categoryId, incomeId),
        ];
        if (year) {
          const [startDate, endDate] = periodRange();
          conditions.push(gte(schema.transactions.date, startDate), lte(schema.transactions.date, endDate));
        }
        const results = await db
          .select({
            total: sql<number>`SUM(${schema.transactions.amountIn}) - SUM(${schema.transactions.amountOut})`,
          })
          .from(schema.transactions)
          .where(and(...conditions));
        return NextResponse.json({ data: results[0]?.total || 0, success: true });
      }

      case "goalProgress": {
        // Lifetime cumulative net per goal category → Record<categoryId, number>.
        const goalCategories = await db
          .select({ id: schema.budgetSubcategories.id })
          .from(schema.budgetSubcategories)
          .where(and(eq(schema.budgetSubcategories.userId, userId), eq(schema.budgetSubcategories.itemType, "goal")));
        const goalIds = new Set(goalCategories.map((g) => g.id));
        if (goalIds.size === 0) return NextResponse.json({ data: {}, success: true });

        const results = await db
          .select({
            categoryId: schema.transactions.budgetItemId,
            total: sql<number>`SUM(${schema.transactions.amountOut}) - SUM(${schema.transactions.amountIn})`,
          })
          .from(schema.transactions)
          .where(and(eq(schema.transactions.userId, userId), isNotNull(schema.transactions.budgetItemId)))
          .groupBy(schema.transactions.budgetItemId);
        const map: Record<number, number> = {};
        for (const r of results) if (r.categoryId !== null && goalIds.has(r.categoryId)) map[r.categoryId] = r.total || 0;
        return NextResponse.json({ data: map, success: true });
      }

      case "monthlyTrend": {
        if (!year) return NextResponse.json({ error: "Year is required", success: false }, { status: 400 });
        const yearNum = parseInt(year, 10);
        const trend = [];
        for (let m = 0; m < 12; m++) {
          const startDate = new Date(yearNum, m, 1);
          const endDate = new Date(yearNum, m + 1, 0, 23, 59, 59);
          const results = await db
            .select({
              income: sql<number>`SUM(${schema.transactions.amountIn})`,
              expenses: sql<number>`SUM(${schema.transactions.amountOut})`,
            })
            .from(schema.transactions)
            .where(
              and(
                eq(schema.transactions.userId, userId),
                gte(schema.transactions.date, startDate),
                lte(schema.transactions.date, endDate),
                ...excludeFilter()
              )
            );
          trend.push({
            month: m,
            monthName: monthNames[m],
            income: results[0]?.income || 0,
            expenses: results[0]?.expenses || 0,
          });
        }
        return NextResponse.json({ data: trend, success: true });
      }

      case "monthlyByCategory": {
        if (!year) return NextResponse.json({ error: "Year is required", success: false }, { status: 400 });
        const yearNum = parseInt(year, 10);
        const rows = [];
        for (let m = 0; m < 12; m++) {
          const startDate = new Date(yearNum, m, 1);
          const endDate = new Date(yearNum, m + 1, 0, 23, 59, 59);
          rows.push({ month: m, monthName: monthNames[m], categoryTotals: await spendingByItem(startDate, endDate) });
        }
        return NextResponse.json({ data: rows, success: true });
      }

      case "allTimeMonthlyByCategory": {
        const allTransactions = await db
          .select()
          .from(schema.transactions)
          .where(and(eq(schema.transactions.userId, userId), isNotNull(schema.transactions.budgetItemId)));
        const monthlyData: Record<string, Record<number, number>> = {};
        for (const t of allTransactions) {
          if (t.budgetItemId === null) continue;
          const key = `${t.date.getFullYear()}-${t.date.getMonth()}`;
          if (!monthlyData[key]) monthlyData[key] = {};
          monthlyData[key][t.budgetItemId] = (monthlyData[key][t.budgetItemId] || 0) + (t.amountOut - t.amountIn);
        }
        const rows = Object.entries(monthlyData)
          .map(([key, categoryTotals]) => {
            const [y, m] = key.split("-").map(Number);
            return { year: y, month: m, monthName: monthNames[m], categoryTotals };
          })
          .sort((a, b) => a.year - b.year || a.month - b.month);
        return NextResponse.json({ data: rows, success: true });
      }

      case "dailyTrend": {
        if (!year || !month) {
          return NextResponse.json({ error: "Year and month are required", success: false }, { status: 400 });
        }
        const yearNum = parseInt(year, 10);
        const monthNum = parseInt(month, 10);
        const daysInMonth = new Date(yearNum, monthNum + 1, 0).getDate();
        const startDate = new Date(yearNum, monthNum, 1);
        const endDate = new Date(yearNum, monthNum + 1, 0, 23, 59, 59);
        const transactions = await db
          .select()
          .from(schema.transactions)
          .where(
            and(
              eq(schema.transactions.userId, userId),
              gte(schema.transactions.date, startDate),
              lte(schema.transactions.date, endDate),
              ...excludeFilter()
            )
          );
        const dailyData: Record<number, { income: number; expenses: number }> = {};
        for (let d = 1; d <= daysInMonth; d++) dailyData[d] = { income: 0, expenses: 0 };
        for (const t of transactions) {
          const day = t.date.getDate();
          dailyData[day].income += t.amountIn;
          dailyData[day].expenses += t.amountOut;
        }
        const trend = Array.from({ length: daysInMonth }, (_, i) => ({
          day: i + 1,
          dayName: String(i + 1),
          income: dailyData[i + 1].income,
          expenses: dailyData[i + 1].expenses,
        }));
        return NextResponse.json({ data: trend, success: true });
      }

      case "allTimeMonthlyTrend": {
        const allTransactions = await db
          .select()
          .from(schema.transactions)
          .where(and(eq(schema.transactions.userId, userId), ...excludeFilter()));
        const monthlyData: Record<string, { income: number; expenses: number }> = {};
        for (const t of allTransactions) {
          const key = `${t.date.getFullYear()}-${t.date.getMonth()}`;
          if (!monthlyData[key]) monthlyData[key] = { income: 0, expenses: 0 };
          monthlyData[key].income += t.amountIn;
          monthlyData[key].expenses += t.amountOut;
        }
        const trend = Object.entries(monthlyData)
          .map(([key, data]) => {
            const [y, m] = key.split("-").map(Number);
            return { year: y, month: m, monthName: monthNames[m], income: data.income, expenses: data.expenses };
          })
          .sort((a, b) => a.year - b.year || a.month - b.month);
        return NextResponse.json({ data: trend, success: true });
      }

      case "count": {
        let countResult;
        if (year) {
          const [startDate, endDate] = periodRange();
          countResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(schema.transactions)
            .where(
              and(
                eq(schema.transactions.userId, userId),
                gte(schema.transactions.date, startDate),
                lte(schema.transactions.date, endDate)
              )
            );
        } else {
          countResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(schema.transactions)
            .where(eq(schema.transactions.userId, userId));
        }
        return NextResponse.json({ data: countResult[0]?.count || 0, success: true });
      }

      case "availablePeriods": {
        const allTransactions = await db
          .select({ date: schema.transactions.date })
          .from(schema.transactions)
          .where(eq(schema.transactions.userId, userId));
        const monthsByYear = new Map<number, Set<number>>();
        for (const t of allTransactions) {
          const y = t.date.getFullYear();
          if (!monthsByYear.has(y)) monthsByYear.set(y, new Set());
          monthsByYear.get(y)!.add(t.date.getMonth());
        }
        const years = Array.from(monthsByYear.keys()).sort((a, b) => b - a);
        const monthsByYearObj: Record<number, number[]> = {};
        for (const [y, months] of monthsByYear) monthsByYearObj[y] = Array.from(months).sort((a, b) => a - b);
        return NextResponse.json({ data: { years, monthsByYear: monthsByYearObj }, success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown aggregation type: ${type}`, success: false }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/transactions/aggregations error:", error);
    return NextResponse.json({ error: "Failed to fetch aggregations", success: false }, { status: 500 });
  }
}
