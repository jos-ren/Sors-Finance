import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

// GET /api/portfolio/snapshots?startDate=...&endDate=...&limit=...
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = searchParams.get("limit");
    const today = searchParams.get("today") === "true";

    if (today) {
      // Check if snapshot exists today
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      const result = await db
        .select()
        .from(schema.portfolioSnapshots)
        .where(
          and(
            gte(schema.portfolioSnapshots.date, startOfDay),
            lte(schema.portfolioSnapshots.date, endOfDay)
          )
        )
        .limit(1);

      return NextResponse.json({
        data: result.length > 0 ? result[0] : null,
        exists: result.length > 0,
        success: true,
      });
    }

    const conditions = [];

    if (startDate) {
      conditions.push(gte(schema.portfolioSnapshots.date, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(schema.portfolioSnapshots.date, new Date(endDate)));
    }

    let query = db
      .select()
      .from(schema.portfolioSnapshots)
      .orderBy(desc(schema.portfolioSnapshots.date));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    if (limit) {
      query = query.limit(parseInt(limit, 10)) as typeof query;
    }

    const results = await query;

    const snapshots = results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      date: row.date,
      totalSavings: row.totalSavings,
      totalInvestments: row.totalInvestments,
      totalAssets: row.totalAssets,
      totalDebt: row.totalDebt,
      netWorth: row.netWorth,
      details: row.details,
      createdAt: row.createdAt,
    }));

    return NextResponse.json({ data: snapshots, success: true });
  } catch (error) {
    console.error("GET /api/portfolio/snapshots error:", error);
    return NextResponse.json(
      { error: "Failed to fetch snapshots", success: false },
      { status: 500 }
    );
  }
}

// POST /api/portfolio/snapshots - Create a new snapshot
// If body is provided, create a historical snapshot with custom values
// If no body, create a snapshot from current portfolio state
export async function POST(request: NextRequest) {
  try {
    const now = new Date();

    // Check if body is provided (for historical snapshot import)
    const contentType = request.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const body = await request.json();

      // If body has date and values, create a historical snapshot
      if (body.date) {
        const result = await db
          .insert(schema.portfolioSnapshots)
          .values({
            uuid: randomUUID(),
            date: new Date(body.date),
            totalSavings: body.totalSavings ?? 0,
            totalInvestments: body.totalInvestments ?? 0,
            totalAssets: body.totalAssets ?? 0,
            totalDebt: body.totalDebt ?? 0,
            netWorth: body.netWorth ?? 0,
            details: body.details ?? { accounts: [], items: [] },
            createdAt: now,
          })
          .returning({ id: schema.portfolioSnapshots.id });

        return NextResponse.json({ data: { id: result[0].id }, success: true });
      }
    }

    // Otherwise, create snapshot from current portfolio state
    const accounts = await db.select().from(schema.portfolioAccounts);
    const items = await db
      .select()
      .from(schema.portfolioItems)
      .where(eq(schema.portfolioItems.isActive, true));

    // Calculate totals by bucket
    let totalSavings = 0;
    let totalInvestments = 0;
    let totalAssets = 0;
    let totalDebt = 0;

    const accountDetails: Array<{ id: number; bucket: string; name: string; total: number }> = [];
    const itemDetails: Array<{ id: number; accountId: number; name: string; value: number }> = [];

    for (const account of accounts) {
      const accountItems = items.filter((i) => i.accountId === account.id);
      const accountTotal = accountItems.reduce((sum, i) => sum + i.currentValue, 0);

      accountDetails.push({
        id: account.id,
        bucket: account.bucket,
        name: account.name,
        total: accountTotal,
      });

      for (const item of accountItems) {
        itemDetails.push({
          id: item.id,
          accountId: item.accountId,
          name: item.name,
          value: item.currentValue,
        });
      }

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

    const result = await db
      .insert(schema.portfolioSnapshots)
      .values({
        uuid: randomUUID(),
        date: now,
        totalSavings,
        totalInvestments,
        totalAssets,
        totalDebt,
        netWorth,
        details: {
          accounts: accountDetails,
          items: itemDetails,
        },
        createdAt: now,
      })
      .returning({ id: schema.portfolioSnapshots.id });

    return NextResponse.json({ data: { id: result[0].id }, success: true });
  } catch (error) {
    console.error("POST /api/portfolio/snapshots error:", error);
    return NextResponse.json(
      { error: "Failed to create snapshot", success: false },
      { status: 500 }
    );
  }
}
