import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { findMatchingCategories } from "@/lib/categories/categorizer";
import { buildMatchables } from "@/lib/budget/matchables";
import { normalizeAssignment } from "@/lib/budget/normalize-assignment";
import { SYSTEM_CATEGORIES } from "@/lib/db/types";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/transactions/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);

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
      .where(
        and(
          eq(schema.transactions.id, transactionId),
          eq(schema.transactions.userId, userId)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Transaction not found", success: false },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result[0], success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
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
    const { userId } = await requireAuth(request);

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

    // Check if transaction exists and belongs to user
    const existing = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.id, transactionId),
          eq(schema.transactions.userId, userId)
        )
      )
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
    if (updates.note !== undefined) updateValues.note = updates.note;
    if (updates.categoryLocked !== undefined) updateValues.categoryLocked = updates.categoryLocked;
    if (updates.reviewStatus !== undefined) updateValues.reviewStatus = updates.reviewStatus;
    if (updates.conflictCategories !== undefined) updateValues.conflictCategories = updates.conflictCategories;

    // Apply the one-FK rule whenever an assignment is provided.
    if (updates.categoryId !== undefined || updates.budgetItemId !== undefined) {
      const { categoryId, budgetItemId } = normalizeAssignment({
        categoryId: updates.categoryId,
        budgetItemId: updates.budgetItemId,
      });
      updateValues.categoryId = categoryId;
      updateValues.budgetItemId = budgetItemId;
    }

    // When unlocking without an explicit assignment, re-run keyword matching
    // against active budget categories + the Income system category.
    if (
      updates.categoryLocked === false &&
      updates.categoryId === undefined &&
      updates.budgetItemId === undefined
    ) {
      const [activeItems, incomeCat] = await Promise.all([
        db
          .select()
          .from(schema.budgetSubcategories)
          .where(and(eq(schema.budgetSubcategories.userId, userId), eq(schema.budgetSubcategories.isActive, true))),
        db
          .select()
          .from(schema.categories)
          .where(and(eq(schema.categories.name, SYSTEM_CATEGORIES.INCOME), eq(schema.categories.userId, userId)))
          .limit(1),
      ]);
      const matchables = buildMatchables(activeItems, incomeCat[0] ?? null);
      const matches = findMatchingCategories(existing[0].matchField, matchables);
      if (matches.length === 1) {
        const m = matches[0];
        updateValues.categoryId = m.kind === "system" ? m.refId : null;
        updateValues.budgetItemId = m.kind === "item" ? m.refId : null;
      } else {
        updateValues.categoryId = null;
        updateValues.budgetItemId = null;
      }
    }

    await db
      .update(schema.transactions)
      .set(updateValues)
      .where(
        and(
          eq(schema.transactions.id, transactionId),
          eq(schema.transactions.userId, userId)
        )
      );

    return NextResponse.json({ data: { updated: true }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
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
    const { userId } = await requireAuth(request);

    const { id } = await context.params;
    const transactionId = parseInt(id, 10);

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { error: "Invalid transaction ID", success: false },
        { status: 400 }
      );
    }

    // Check if transaction exists and belongs to user
    const existing = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.id, transactionId),
          eq(schema.transactions.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Transaction not found", success: false },
        { status: 404 }
      );
    }

    await db
      .delete(schema.transactions)
      .where(
        and(
          eq(schema.transactions.id, transactionId),
          eq(schema.transactions.userId, userId)
        )
      );

    return NextResponse.json({ data: { deleted: true }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("DELETE /api/transactions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction", success: false },
      { status: 500 }
    );
  }
}
