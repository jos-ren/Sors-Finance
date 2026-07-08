import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { normalizeAssignment } from "@/lib/budget/normalize-assignment";

// GET /api/transactions?startDate=...&endDate=...&categoryId=...&source=...&limit=...&offset=...
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const categoryId = searchParams.get("categoryId");
    const budgetItemId = searchParams.get("budgetItemId");
    const source = searchParams.get("source");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    // Build conditions - always filter by userId
    const conditions = [eq(schema.transactions.userId, userId)];

    if (startDate) {
      conditions.push(gte(schema.transactions.date, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(schema.transactions.date, new Date(endDate)));
    }
    if (categoryId) {
      conditions.push(eq(schema.transactions.categoryId, parseInt(categoryId, 10)));
    }
    if (budgetItemId) {
      conditions.push(eq(schema.transactions.budgetItemId, parseInt(budgetItemId, 10)));
    }
    if (source) {
      conditions.push(eq(schema.transactions.source, source));
    }

    let query = db
      .select()
      .from(schema.transactions)
      .where(and(...conditions))
      .orderBy(desc(schema.transactions.date));

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
      sourceMethod: row.sourceMethod,
      sourceAccountName: row.sourceAccountName,
      note: row.note,
      categoryId: row.categoryId,
      budgetItemId: row.budgetItemId,
      categoryLocked: row.categoryLocked,
      reviewStatus: row.reviewStatus,
      conflictCategories: row.conflictCategories,
      importId: row.importId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return NextResponse.json({ data: transactions, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
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
    const { userId } = await requireAuth(request);

    const body = await request.json();
    const now = new Date();
    const { categoryId, budgetItemId } = normalizeAssignment({
      categoryId: body.categoryId,
      budgetItemId: body.budgetItemId,
    });

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
        note: body.note || null,
        categoryId,
        budgetItemId,
        importId: body.importId || null,
        userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: schema.transactions.id });

    return NextResponse.json({ data: { id: result[0].id }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/transactions error:", error);
    return NextResponse.json(
      { error: "Failed to create transaction", success: false },
      { status: 500 }
    );
  }
}

// DELETE /api/transactions (bulk delete, or all=true to wipe every transaction)
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    if (request.nextUrl.searchParams.get("all") === "true") {
      const result = await db
        .delete(schema.transactions)
        .where(eq(schema.transactions.userId, userId))
        .returning({ id: schema.transactions.id });

      return NextResponse.json({ data: { deleted: result.length }, success: true });
    }

    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids array is required", success: false },
        { status: 400 }
      );
    }

    await db
      .delete(schema.transactions)
      .where(
        and(
          inArray(schema.transactions.id, ids),
          eq(schema.transactions.userId, userId)
        )
      );

    return NextResponse.json({ data: { deleted: ids.length }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("DELETE /api/transactions error:", error);
    return NextResponse.json(
      { error: "Failed to delete transactions", success: false },
      { status: 500 }
    );
  }
}
