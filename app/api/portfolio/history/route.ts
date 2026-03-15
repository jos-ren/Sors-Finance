import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

// GET /api/portfolio/history?bucket=Investments
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const bucket = request.nextUrl.searchParams.get("bucket");

    const rows = await db
      .select({
        history: schema.portfolioItemHistory,
        itemName: schema.portfolioItems.name,
        itemType: schema.portfolioItems.type,
        accountId: schema.portfolioItems.accountId,
        accountBucket: schema.portfolioAccounts.bucket,
        accountName: schema.portfolioAccounts.name,
      })
      .from(schema.portfolioItemHistory)
      .innerJoin(
        schema.portfolioItems,
        eq(schema.portfolioItemHistory.itemId, schema.portfolioItems.id)
      )
      .innerJoin(
        schema.portfolioAccounts,
        eq(schema.portfolioItems.accountId, schema.portfolioAccounts.id)
      )
      .where(
        bucket
          ? and(
              eq(schema.portfolioItemHistory.userId, userId),
              eq(schema.portfolioAccounts.bucket, bucket)
            )
          : eq(schema.portfolioItemHistory.userId, userId)
      )
      .orderBy(desc(schema.portfolioItemHistory.createdAt))
      .limit(50);

    const data = rows.map((row) => ({
      ...row.history,
      itemName: row.itemName,
      itemType: row.itemType,
      accountBucket: row.accountBucket,
      accountName: row.accountName,
    }));

    return NextResponse.json({ data, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/portfolio/history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio history", success: false },
      { status: 500 }
    );
  }
}
