import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, gte, lte, ne, sql } from "drizzle-orm";

// GET /api/transactions/aggregations?type=spending&year=2024&month=1
// Types: spending, totals, trend, allTime, allTimeByCategory, allTimeTrend, count
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "spending";
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    // Get excluded category
    const excludedCat = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.name, "Excluded"))
      .limit(1);
    const excludedId = excludedCat[0]?.id;

    switch (type) {
      case "spending": {
        // Spending by category for a period
        if (!year) {
          return NextResponse.json(
            { error: "Year is required", success: false },
            { status: 400 }
          );
        }

        const yearNum = parseInt(year, 10);
        let startDate: Date;
        let endDate: Date;

        if (month) {
          const monthNum = parseInt(month, 10);
          startDate = new Date(yearNum, monthNum, 1);
          endDate = new Date(yearNum, monthNum + 1, 0, 23, 59, 59);
        } else {
          startDate = new Date(yearNum, 0, 1);
          endDate = new Date(yearNum, 11, 31, 23, 59, 59);
        }

        const results = await db
          .select({
            categoryId: schema.transactions.categoryId,
            total: sql<number>`SUM(${schema.transactions.amountOut})`,
          })
          .from(schema.transactions)
          .where(
            and(
              gte(schema.transactions.date, startDate),
              lte(schema.transactions.date, endDate),
              excludedId ? ne(schema.transactions.categoryId, excludedId) : undefined
            )
          )
          .groupBy(schema.transactions.categoryId);

        const spendingMap: Record<number, number> = {};
        for (const r of results) {
          if (r.categoryId !== null) {
            spendingMap[r.categoryId] = r.total || 0;
          }
        }

        return NextResponse.json({ data: spendingMap, success: true });
      }

      case "ytdSpending": {
        // Year-to-date spending by category
        if (!year) {
          return NextResponse.json(
            { error: "Year is required", success: false },
            { status: 400 }
          );
        }

        const yearNum = parseInt(year, 10);
        const now = new Date();
        const startDate = new Date(yearNum, 0, 1);
        const endDate = yearNum === now.getFullYear() ? now : new Date(yearNum, 11, 31, 23, 59, 59);

        const results = await db
          .select({
            categoryId: schema.transactions.categoryId,
            total: sql<number>`SUM(${schema.transactions.amountOut})`,
          })
          .from(schema.transactions)
          .where(
            and(
              gte(schema.transactions.date, startDate),
              lte(schema.transactions.date, endDate),
              excludedId ? ne(schema.transactions.categoryId, excludedId) : undefined
            )
          )
          .groupBy(schema.transactions.categoryId);

        const spendingMap: Record<number, number> = {};
        for (const r of results) {
          if (r.categoryId !== null) {
            spendingMap[r.categoryId] = r.total || 0;
          }
        }

        return NextResponse.json({ data: spendingMap, success: true });
      }

      case "totals": {
        // Income and expenses totals for a period
        if (!year) {
          return NextResponse.json(
            { error: "Year is required", success: false },
            { status: 400 }
          );
        }

        const yearNum = parseInt(year, 10);
        let startDate: Date;
        let endDate: Date;

        if (month) {
          const monthNum = parseInt(month, 10);
          startDate = new Date(yearNum, monthNum, 1);
          endDate = new Date(yearNum, monthNum + 1, 0, 23, 59, 59);
        } else {
          startDate = new Date(yearNum, 0, 1);
          endDate = new Date(yearNum, 11, 31, 23, 59, 59);
        }

        const results = await db
          .select({
            income: sql<number>`SUM(${schema.transactions.amountIn})`,
            expenses: sql<number>`SUM(${schema.transactions.amountOut})`,
          })
          .from(schema.transactions)
          .where(
            and(
              gte(schema.transactions.date, startDate),
              lte(schema.transactions.date, endDate),
              excludedId ? ne(schema.transactions.categoryId, excludedId) : undefined
            )
          );

        return NextResponse.json({
          data: {
            income: results[0]?.income || 0,
            expenses: results[0]?.expenses || 0,
          },
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
          .where(excludedId ? ne(schema.transactions.categoryId, excludedId) : undefined);

        return NextResponse.json({
          data: {
            income: results[0]?.income || 0,
            expenses: results[0]?.expenses || 0,
          },
          success: true,
        });
      }

      case "allTimeByCategory": {
        const results = await db
          .select({
            categoryId: schema.transactions.categoryId,
            total: sql<number>`SUM(${schema.transactions.amountOut})`,
          })
          .from(schema.transactions)
          .where(excludedId ? ne(schema.transactions.categoryId, excludedId) : undefined)
          .groupBy(schema.transactions.categoryId);

        const spendingMap: Record<number, number> = {};
        for (const r of results) {
          if (r.categoryId !== null) {
            spendingMap[r.categoryId] = r.total || 0;
          }
        }

        return NextResponse.json({ data: spendingMap, success: true });
      }

      case "monthlyTrend": {
        // Monthly trend for a year
        if (!year) {
          return NextResponse.json(
            { error: "Year is required", success: false },
            { status: 400 }
          );
        }

        const yearNum = parseInt(year, 10);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
                gte(schema.transactions.date, startDate),
                lte(schema.transactions.date, endDate),
                excludedId ? ne(schema.transactions.categoryId, excludedId) : undefined
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

      case "dailyTrend": {
        // Daily trend for a month
        if (!year || !month) {
          return NextResponse.json(
            { error: "Year and month are required", success: false },
            { status: 400 }
          );
        }

        const yearNum = parseInt(year, 10);
        const monthNum = parseInt(month, 10);
        const daysInMonth = new Date(yearNum, monthNum + 1, 0).getDate();
        const startDate = new Date(yearNum, monthNum, 1);
        const endDate = new Date(yearNum, monthNum + 1, 0, 23, 59, 59);

        // Get all transactions for the month
        const transactions = await db
          .select()
          .from(schema.transactions)
          .where(
            and(
              gte(schema.transactions.date, startDate),
              lte(schema.transactions.date, endDate),
              excludedId ? ne(schema.transactions.categoryId, excludedId) : undefined
            )
          );

        // Group by day
        const dailyData: Record<number, { income: number; expenses: number }> = {};
        for (let d = 1; d <= daysInMonth; d++) {
          dailyData[d] = { income: 0, expenses: 0 };
        }

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
        // Get all transactions grouped by year/month
        const allTransactions = await db
          .select()
          .from(schema.transactions)
          .where(excludedId ? ne(schema.transactions.categoryId, excludedId) : undefined);

        const monthlyData: Record<string, { income: number; expenses: number }> = {};

        for (const t of allTransactions) {
          const year = t.date.getFullYear();
          const month = t.date.getMonth();
          const key = `${year}-${month}`;

          if (!monthlyData[key]) {
            monthlyData[key] = { income: 0, expenses: 0 };
          }
          monthlyData[key].income += t.amountIn;
          monthlyData[key].expenses += t.amountOut;
        }

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const trend = Object.entries(monthlyData)
          .map(([key, data]) => {
            const [year, month] = key.split("-").map(Number);
            return {
              year,
              month,
              monthName: monthNames[month],
              income: data.income,
              expenses: data.expenses,
            };
          })
          .sort((a, b) => a.year - b.year || a.month - b.month);

        return NextResponse.json({ data: trend, success: true });
      }

      case "count": {
        // Transaction count
        let countResult;

        if (year) {
          const yearNum = parseInt(year, 10);
          let startDate: Date;
          let endDate: Date;

          if (month) {
            const monthNum = parseInt(month, 10);
            startDate = new Date(yearNum, monthNum, 1);
            endDate = new Date(yearNum, monthNum + 1, 0, 23, 59, 59);
          } else {
            startDate = new Date(yearNum, 0, 1);
            endDate = new Date(yearNum, 11, 31, 23, 59, 59);
          }

          countResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(schema.transactions)
            .where(
              and(
                gte(schema.transactions.date, startDate),
                lte(schema.transactions.date, endDate)
              )
            );
        } else {
          countResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(schema.transactions);
        }

        return NextResponse.json({ data: countResult[0]?.count || 0, success: true });
      }

      case "availablePeriods": {
        // Get all unique year/month combinations
        const allTransactions = await db.select().from(schema.transactions);

        const monthsByYear = new Map<number, Set<number>>();

        for (const t of allTransactions) {
          const year = t.date.getFullYear();
          const month = t.date.getMonth();

          if (!monthsByYear.has(year)) {
            monthsByYear.set(year, new Set());
          }
          monthsByYear.get(year)!.add(month);
        }

        const years = Array.from(monthsByYear.keys()).sort((a, b) => b - a);
        const monthsByYearObj: Record<number, number[]> = {};
        for (const [year, months] of monthsByYear) {
          monthsByYearObj[year] = Array.from(months).sort((a, b) => a - b);
        }

        return NextResponse.json({
          data: { years, monthsByYear: monthsByYearObj },
          success: true,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown aggregation type: ${type}`, success: false },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("GET /api/transactions/aggregations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch aggregations", success: false },
      { status: 500 }
    );
  }
}
