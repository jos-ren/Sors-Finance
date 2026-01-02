import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, desc, and } from "drizzle-orm";

// GET /api/portfolio/summary?type=netWorth|buckets|change|accountTotal
export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type") || "netWorth";
    const accountId = request.nextUrl.searchParams.get("accountId");
    const bucket = request.nextUrl.searchParams.get("bucket");

    switch (type) {
      case "netWorth": {
        // Get all active items
        const accounts = await db.select().from(schema.portfolioAccounts);
        const items = await db
          .select()
          .from(schema.portfolioItems)
          .where(eq(schema.portfolioItems.isActive, true));

        let totalSavings = 0;
        let totalInvestments = 0;
        let totalAssets = 0;
        let totalDebt = 0;

        for (const account of accounts) {
          const accountItems = items.filter((i) => i.accountId === account.id);
          const accountTotal = accountItems.reduce((sum, i) => sum + i.currentValue, 0);

          switch (account.bucket) {
            case "Savings":
              totalSavings += accountTotal;
              break;
            case "Investments":
              totalInvestments += accountTotal;
              break;
            case "Assets":
              totalAssets += accountTotal;
              break;
            case "Debt":
              totalDebt += accountTotal;
              break;
          }
        }

        const netWorth = totalSavings + totalInvestments + totalAssets - totalDebt;

        return NextResponse.json({
          data: {
            totalSavings,
            totalInvestments,
            totalAssets,
            totalDebt,
            netWorth,
          },
          success: true,
        });
      }

      case "buckets": {
        // Get bucket breakdown
        const accounts = await db.select().from(schema.portfolioAccounts);
        const items = await db
          .select()
          .from(schema.portfolioItems)
          .where(eq(schema.portfolioItems.isActive, true));

        const buckets: Record<string, number> = {
          Savings: 0,
          Investments: 0,
          Assets: 0,
          Debt: 0,
        };

        for (const account of accounts) {
          const accountItems = items.filter((i) => i.accountId === account.id);
          const accountTotal = accountItems.reduce((sum, i) => sum + i.currentValue, 0);
          buckets[account.bucket] += accountTotal;
        }

        return NextResponse.json({ data: buckets, success: true });
      }

      case "bucketTotal": {
        if (!bucket) {
          return NextResponse.json(
            { error: "bucket is required", success: false },
            { status: 400 }
          );
        }

        const accounts = await db
          .select()
          .from(schema.portfolioAccounts)
          .where(eq(schema.portfolioAccounts.bucket, bucket));

        const accountIds = accounts.map((a) => a.id);

        if (accountIds.length === 0) {
          return NextResponse.json({ data: 0, success: true });
        }

        let total = 0;
        for (const accountId of accountIds) {
          const items = await db
            .select()
            .from(schema.portfolioItems)
            .where(
              and(
                eq(schema.portfolioItems.accountId, accountId),
                eq(schema.portfolioItems.isActive, true)
              )
            );
          total += items.reduce((sum, i) => sum + i.currentValue, 0);
        }

        return NextResponse.json({ data: total, success: true });
      }

      case "accountTotal": {
        if (!accountId) {
          return NextResponse.json(
            { error: "accountId is required", success: false },
            { status: 400 }
          );
        }

        const items = await db
          .select()
          .from(schema.portfolioItems)
          .where(
            and(
              eq(schema.portfolioItems.accountId, parseInt(accountId, 10)),
              eq(schema.portfolioItems.isActive, true)
            )
          );

        const total = items.reduce((sum, i) => sum + i.currentValue, 0);

        return NextResponse.json({ data: total, success: true });
      }

      case "change": {
        // Get current net worth
        const accounts = await db.select().from(schema.portfolioAccounts);
        const items = await db
          .select()
          .from(schema.portfolioItems)
          .where(eq(schema.portfolioItems.isActive, true));

        let currentNetWorth = 0;
        for (const account of accounts) {
          const accountItems = items.filter((i) => i.accountId === account.id);
          const accountTotal = accountItems.reduce((sum, i) => sum + i.currentValue, 0);

          if (account.bucket === "Debt") {
            currentNetWorth -= accountTotal;
          } else {
            currentNetWorth += accountTotal;
          }
        }

        // Get most recent snapshot
        const snapshots = await db
          .select()
          .from(schema.portfolioSnapshots)
          .orderBy(desc(schema.portfolioSnapshots.date))
          .limit(2);

        let previousNetWorth = 0;
        if (snapshots.length > 0) {
          // Use the second most recent if current snapshot exists, otherwise use the most recent
          const now = new Date();
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const latestIsToday = snapshots[0].date >= startOfDay;

          if (latestIsToday && snapshots.length > 1) {
            previousNetWorth = snapshots[1].netWorth;
          } else if (!latestIsToday) {
            previousNetWorth = snapshots[0].netWorth;
          }
        }

        const change = currentNetWorth - previousNetWorth;
        const changePercent = previousNetWorth !== 0 ? (change / previousNetWorth) * 100 : 0;

        return NextResponse.json({
          data: {
            current: currentNetWorth,
            previous: previousNetWorth,
            change,
            changePercent,
          },
          success: true,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown summary type: ${type}`, success: false },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("GET /api/portfolio/summary error:", error);
    return NextResponse.json(
      { error: "Failed to fetch summary", success: false },
      { status: 500 }
    );
  }
}
