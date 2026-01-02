import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

// GET /api/transactions?startDate=...&endDate=...&categoryId=...&source=...&limit=...&offset=...
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const categoryId = searchParams.get("categoryId");
    const source = searchParams.get("source");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    // Build conditions
    const conditions = [];

    if (startDate) {
      conditions.push(gte(schema.transactions.date, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(schema.transactions.date, new Date(endDate)));
    }
    if (categoryId) {
      conditions.push(eq(schema.transactions.categoryId, parseInt(categoryId, 10)));
    }
    if (source) {
      conditions.push(eq(schema.transactions.source, source));
    }

    let query = db
      .select()
      .from(schema.transactions)
      .orderBy(desc(schema.transactions.date));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    if (limit) {
      query = query.limit(parseInt(limit, 10)) as typeof query;
    }
    if (offset) {
      query = query.offset(parseInt(offset, 10)) as typeof query;
    }

    const results = await query;

    const transactions = results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      date: row.date,
      description: row.description,
      matchField: row.matchField,
      amountOut: row.amountOut,
      amountIn: row.amountIn,
      netAmount: row.netAmount,
      source: row.source,
      categoryId: row.categoryId,
      importId: row.importId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return NextResponse.json({ data: transactions, success: true });
  } catch (error) {
    console.error("GET /api/transactions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions", success: false },
      { status: 500 }
    );
  }
}

// POST /api/transactions (single transaction)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const now = new Date();

    const result = await db
      .insert(schema.transactions)
      .values({
        uuid: randomUUID(),
        date: new Date(body.date),
        description: body.description,
        matchField: body.matchField || body.description,
        amountOut: body.amountOut ?? 0,
        amountIn: body.amountIn ?? 0,
        netAmount: body.netAmount ?? (body.amountIn - body.amountOut),
        source: body.source || "Manual",
        categoryId: body.categoryId || null,
        importId: body.importId || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: schema.transactions.id });

    return NextResponse.json({ data: { id: result[0].id }, success: true });
  } catch (error) {
    console.error("POST /api/transactions error:", error);
    return NextResponse.json(
      { error: "Failed to create transaction", success: false },
      { status: 500 }
    );
  }
}

// DELETE /api/transactions (bulk delete)
export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids array is required", success: false },
        { status: 400 }
      );
    }

    await db
      .delete(schema.transactions)
      .where(inArray(schema.transactions.id, ids));

    return NextResponse.json({ data: { deleted: ids.length }, success: true });
  } catch (error) {
    console.error("DELETE /api/transactions error:", error);
    return NextResponse.json(
      { error: "Failed to delete transactions", success: false },
      { status: 500 }
    );
  }
}
