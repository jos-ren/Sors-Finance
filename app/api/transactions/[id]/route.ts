import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/transactions/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const transactionId = parseInt(id, 10);

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { error: "Invalid transaction ID", success: false },
        { status: 400 }
      );
    }

    const result = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, transactionId))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Transaction not found", success: false },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result[0], success: true });
  } catch (error) {
    console.error("GET /api/transactions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction", success: false },
      { status: 500 }
    );
  }
}

// PUT /api/transactions/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const transactionId = parseInt(id, 10);

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { error: "Invalid transaction ID", success: false },
        { status: 400 }
      );
    }

    const updates = await request.json();
    const now = new Date();

    // Check if transaction exists
    const existing = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, transactionId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Transaction not found", success: false },
        { status: 404 }
      );
    }

    // Prepare update values
    const updateValues: Record<string, unknown> = { updatedAt: now };

    if (updates.date !== undefined) updateValues.date = new Date(updates.date);
    if (updates.description !== undefined) updateValues.description = updates.description;
    if (updates.matchField !== undefined) updateValues.matchField = updates.matchField;
    if (updates.amountOut !== undefined) updateValues.amountOut = updates.amountOut;
    if (updates.amountIn !== undefined) updateValues.amountIn = updates.amountIn;
    if (updates.netAmount !== undefined) updateValues.netAmount = updates.netAmount;
    if (updates.source !== undefined) updateValues.source = updates.source;
    if (updates.categoryId !== undefined) updateValues.categoryId = updates.categoryId;

    await db
      .update(schema.transactions)
      .set(updateValues)
      .where(eq(schema.transactions.id, transactionId));

    return NextResponse.json({ data: { updated: true }, success: true });
  } catch (error) {
    console.error("PUT /api/transactions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update transaction", success: false },
      { status: 500 }
    );
  }
}

// DELETE /api/transactions/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const transactionId = parseInt(id, 10);

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { error: "Invalid transaction ID", success: false },
        { status: 400 }
      );
    }

    // Check if transaction exists
    const existing = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, transactionId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Transaction not found", success: false },
        { status: 404 }
      );
    }

    await db.delete(schema.transactions).where(eq(schema.transactions.id, transactionId));

    return NextResponse.json({ data: { deleted: true }, success: true });
  } catch (error) {
    console.error("DELETE /api/transactions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction", success: false },
      { status: 500 }
    );
  }
}
