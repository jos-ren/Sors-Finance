import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/categories/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);

    const { id } = await context.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      return NextResponse.json(
        { error: "Invalid category ID", success: false },
        { status: 400 }
      );
    }

    const result = await db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.id, categoryId),
          eq(schema.categories.userId, userId)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Category not found", success: false },
        { status: 404 }
      );
    }

    const row = result[0];
    const category = {
      id: row.id,
      uuid: row.uuid,
      name: row.name,
      keywords: row.keywords,
      order: row.order,
      isSystem: row.isSystem ?? false,
      excludeFromBudget: row.excludeFromBudget ?? false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return NextResponse.json({ data: category, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/categories/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch category", success: false },
      { status: 500 }
    );
  }
}

// PUT /api/categories/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);

    const { id } = await context.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      return NextResponse.json(
        { error: "Invalid category ID", success: false },
        { status: 400 }
      );
    }

    const updates = await request.json();
    const now = new Date();

    // Check if category exists and belongs to user
    const existing = await db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.id, categoryId),
          eq(schema.categories.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Category not found", success: false },
        { status: 404 }
      );
    }

    const category = existing[0];

    // Don't allow editing system category names
    if (category.isSystem && updates.name && updates.name !== category.name) {
      return NextResponse.json(
        { error: "Cannot rename system categories", success: false },
        { status: 400 }
      );
    }

    // Prepare update values
    const updateValues: Record<string, unknown> = { updatedAt: now };
    if (updates.name !== undefined) updateValues.name = updates.name;
    if (updates.keywords !== undefined) updateValues.keywords = updates.keywords;
    if (updates.order !== undefined) updateValues.order = updates.order;
    if (updates.excludeFromBudget !== undefined) updateValues.excludeFromBudget = updates.excludeFromBudget;

    await db
      .update(schema.categories)
      .set(updateValues)
      .where(
        and(
          eq(schema.categories.id, categoryId),
          eq(schema.categories.userId, userId)
        )
      );

    // If keywords changed, recategorize affected transactions
    const result = { assigned: 0, uncategorized: 0, conflicts: 0 };

    if (updates.keywords !== undefined) {
      // Get uncategorized category for this user
      const uncategorizedCat = await db
        .select()
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.name, "Uncategorized"),
            eq(schema.categories.userId, userId)
          )
        )
        .limit(1);

      const uncategorizedId = uncategorizedCat[0]?.id;

      // Find transactions that might now match this category
      const uncategorizedTransactions = await db
        .select()
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.categoryId, uncategorizedId!),
            eq(schema.transactions.userId, userId)
          )
        );

      // Recategorize uncategorized transactions
      for (const t of uncategorizedTransactions) {
        const matchText = t.matchField.toLowerCase();
        const keywordsToCheck = updates.keywords as string[];

        const matches = keywordsToCheck.some((kw: string) =>
          matchText.includes(kw.toLowerCase())
        );

        if (matches) {
          await db
            .update(schema.transactions)
            .set({ categoryId, updatedAt: now })
            .where(
              and(
                eq(schema.transactions.id, t.id),
                eq(schema.transactions.userId, userId)
              )
            );
          result.assigned++;
        }
      }
    }

    return NextResponse.json({ data: result, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("PUT /api/categories/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update category", success: false },
      { status: 500 }
    );
  }
}

// DELETE /api/categories/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);

    const { id } = await context.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      return NextResponse.json(
        { error: "Invalid category ID", success: false },
        { status: 400 }
      );
    }

    // Check if category exists, is not a system category, and belongs to user
    const existing = await db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.id, categoryId),
          eq(schema.categories.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Category not found", success: false },
        { status: 404 }
      );
    }

    if (existing[0].isSystem) {
      return NextResponse.json(
        { error: "Cannot delete system categories", success: false },
        { status: 400 }
      );
    }

    // Get uncategorized category to reassign transactions
    const uncategorizedCat = await db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.name, "Uncategorized"),
          eq(schema.categories.userId, userId)
        )
      )
      .limit(1);

    const uncategorizedId = uncategorizedCat[0]?.id;

    // Reassign transactions to uncategorized
    const now = new Date();
    await db
      .update(schema.transactions)
      .set({ categoryId: uncategorizedId, updatedAt: now })
      .where(
        and(
          eq(schema.transactions.categoryId, categoryId),
          eq(schema.transactions.userId, userId)
        )
      );

    // Delete budgets for this category (filtered by user via category ownership)
    await db
      .delete(schema.budgets)
      .where(
        and(
          eq(schema.budgets.categoryId, categoryId),
          eq(schema.budgets.userId, userId)
        )
      );

    // Delete the category
    await db
      .delete(schema.categories)
      .where(
        and(
          eq(schema.categories.id, categoryId),
          eq(schema.categories.userId, userId)
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
    console.error("DELETE /api/categories/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete category", success: false },
      { status: 500 }
    );
  }
}
