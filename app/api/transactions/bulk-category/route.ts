import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

// PATCH /api/transactions/bulk-category
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const { ids, categoryId } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Transaction IDs array is required", success: false },
        { status: 400 }
      );
    }

    // Validate categoryId (null is allowed for uncategorizing)
    if (categoryId !== null && typeof categoryId !== "number") {
      return NextResponse.json(
        { error: "Invalid category ID", success: false },
        { status: 400 }
      );
    }

    // If categoryId is provided, verify it exists and belongs to user
    if (categoryId !== null) {
      const category = await db
        .select()
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.id, categoryId),
            eq(schema.categories.userId, userId)
          )
        )
        .limit(1);

      if (category.length === 0) {
        return NextResponse.json(
          { error: "Category not found", success: false },
          { status: 404 }
        );
      }
    }

    const now = new Date();

    // Update transactions (only those belonging to user)
    const result = await db
      .update(schema.transactions)
      .set({ categoryId, updatedAt: now })
      .where(
        and(
          inArray(schema.transactions.id, ids),
          eq(schema.transactions.userId, userId)
        )
      );

    return NextResponse.json({
      data: { updated: ids.length },
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("PATCH /api/transactions/bulk-category error:", error);
    return NextResponse.json(
      { error: "Failed to update transactions", success: false },
      { status: 500 }
    );
  }
}
