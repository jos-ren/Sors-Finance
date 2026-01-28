import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, asc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

// GET /api/portfolio/items?accountId=1&includeInactive=false
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const accountId = request.nextUrl.searchParams.get("accountId");
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";
    const tickerMode = request.nextUrl.searchParams.get("tickerMode") === "true";

    const conditions = [eq(schema.portfolioItems.userId, userId)];

    if (accountId) {
      conditions.push(eq(schema.portfolioItems.accountId, parseInt(accountId, 10)));
    }

    if (!includeInactive) {
      conditions.push(eq(schema.portfolioItems.isActive, true));
    }

    if (tickerMode) {
      conditions.push(eq(schema.portfolioItems.priceMode, "ticker"));
    }

    const results = await db
      .select()
      .from(schema.portfolioItems)
      .where(and(...conditions))
      .orderBy(asc(schema.portfolioItems.order));

    const items = results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      accountId: row.accountId,
      name: row.name,
      currentValue: row.currentValue,
      notes: row.notes,
      order: row.order,
      isActive: row.isActive,
      ticker: row.ticker,
      quantity: row.quantity,
      pricePerUnit: row.pricePerUnit,
      currency: row.currency,
      lastPriceUpdate: row.lastPriceUpdate,
      priceMode: row.priceMode,
      isInternational: row.isInternational,
      plaidAccountId: row.plaidAccountId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return NextResponse.json({ data: items, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/portfolio/items error:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio items", success: false },
      { status: 500 }
    );
  }
}

// POST /api/portfolio/items
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const body = await request.json();

    if (!body.accountId || !body.name) {
      return NextResponse.json(
        { error: "accountId and name are required", success: false },
        { status: 400 }
      );
    }

    // Get max order for this account and user
    const maxOrderResult = await db
      .select({ maxOrder: sql<number>`MAX(${schema.portfolioItems.order})` })
      .from(schema.portfolioItems)
      .where(
        and(
          eq(schema.portfolioItems.accountId, body.accountId),
          eq(schema.portfolioItems.userId, userId)
        )
      );

    const order = (maxOrderResult[0]?.maxOrder ?? -1) + 1;
    const now = new Date();

    // Determine price mode
    const priceMode = body.priceMode || (body.ticker ? "ticker" : "manual");

    const result = await db
      .insert(schema.portfolioItems)
      .values({
        uuid: randomUUID(),
        accountId: body.accountId,
        name: body.name,
        currentValue: body.currentValue ?? 0,
        notes: body.notes || null,
        order,
        isActive: true,
        ticker: body.ticker || null,
        quantity: body.quantity || null,
        pricePerUnit: body.pricePerUnit || null,
        currency: body.currency || null,
        lastPriceUpdate: body.lastPriceUpdate ? new Date(body.lastPriceUpdate) : null,
        priceMode,
        isInternational: body.isInternational || null,
        userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: schema.portfolioItems.id });

    return NextResponse.json({ data: { id: result[0].id }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/portfolio/items error:", error);
    return NextResponse.json(
      { error: "Failed to create portfolio item", success: false },
      { status: 500 }
    );
  }
}
