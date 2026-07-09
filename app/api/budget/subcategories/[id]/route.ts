import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, isNull, or } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { subcategoryDeleteImpact } from "@/lib/budget/hierarchy-db";
import { matchesKeyword, normalizeKeywords } from "@/lib/categories/keyword";

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/budget/subcategories/[id] — rename, reorder, move (groupId),
// keywords, itemType, targetAmount, isActive (archive/restore). Keyword
// changes assign matching currently-uncategorized transactions to this category.
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);
    const { id } = await context.params;
    const subId = parseInt(id, 10);
    if (isNaN(subId)) {
      return NextResponse.json({ error: "Invalid subcategory ID", success: false }, { status: 400 });
    }

    const updates = await request.json();
    const existing = await db
      .select()
      .from(schema.budgetSubcategories)
      .where(and(eq(schema.budgetSubcategories.id, subId), eq(schema.budgetSubcategories.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Subcategory not found", success: false }, { status: 404 });
    }

    const now = new Date();
    const values: Record<string, unknown> = { updatedAt: now };
    if (updates.name !== undefined) values.name = updates.name;
    if (updates.order !== undefined) values.order = updates.order;
    const keywords = updates.keywords !== undefined ? normalizeKeywords(updates.keywords) : undefined;
    if (keywords !== undefined) values.keywords = keywords;
    if (updates.targetAmount !== undefined) values.targetAmount = updates.targetAmount;
    if (updates.targetDate !== undefined)
      values.targetDate = updates.targetDate != null ? new Date(updates.targetDate) : null;
    if (updates.isActive !== undefined) values.isActive = updates.isActive;
    if (updates.itemType !== undefined) values.itemType = updates.itemType === "goal" ? "goal" : "expense";
    if (updates.groupId !== undefined) {
      // Verify the target group belongs to the user before moving.
      const group = await db
        .select({ id: schema.budgetGroups.id })
        .from(schema.budgetGroups)
        .where(and(eq(schema.budgetGroups.id, updates.groupId), eq(schema.budgetGroups.userId, userId)))
        .limit(1);
      if (group.length === 0) {
        return NextResponse.json({ error: "Target group not found", success: false }, { status: 400 });
      }
      values.groupId = updates.groupId;
    }

    await db
      .update(schema.budgetSubcategories)
      .set(values)
      .where(and(eq(schema.budgetSubcategories.id, subId), eq(schema.budgetSubcategories.userId, userId)));

    // On keyword change, assign matching uncategorized transactions to this category.
    const result = { assigned: 0 };
    if (keywords !== undefined) {
      const uncategorizedCat = await db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(and(eq(schema.categories.name, "Uncategorized"), eq(schema.categories.userId, userId)))
        .limit(1);
      const uncatId = uncategorizedCat[0]?.id;

      // Currently-unassigned: no budget category AND (no category or the Uncategorized system category),
      // and not category-locked.
      const candidates = await db
        .select()
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, userId),
            isNull(schema.transactions.budgetItemId),
            eq(schema.transactions.categoryLocked, false),
            uncatId
              ? or(isNull(schema.transactions.categoryId), eq(schema.transactions.categoryId, uncatId))
              : isNull(schema.transactions.categoryId)
          )
        );

      for (const t of candidates) {
        if (keywords.some((kw) => matchesKeyword(t.matchField, kw))) {
          await db
            .update(schema.transactions)
            .set({ budgetItemId: subId, categoryId: null, updatedAt: now })
            .where(and(eq(schema.transactions.id, t.id), eq(schema.transactions.userId, userId)));
          result.assigned++;
        }
      }
    }

    return NextResponse.json({ data: result, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("PUT /api/budget/subcategories/[id] error:", error);
    return NextResponse.json({ error: "Failed to update subcategory", success: false }, { status: 500 });
  }
}

// DELETE /api/budget/subcategories/[id] — cascades budgets; transactions become
// uncategorized (FK set null). Returns affected counts.
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);
    const { id } = await context.params;
    const subId = parseInt(id, 10);
    if (isNaN(subId)) {
      return NextResponse.json({ error: "Invalid subcategory ID", success: false }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(schema.budgetSubcategories)
      .where(and(eq(schema.budgetSubcategories.id, subId), eq(schema.budgetSubcategories.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Subcategory not found", success: false }, { status: 404 });
    }

    const impact = await subcategoryDeleteImpact(userId, subId);

    await db
      .delete(schema.budgetSubcategories)
      .where(and(eq(schema.budgetSubcategories.id, subId), eq(schema.budgetSubcategories.userId, userId)));

    return NextResponse.json({ data: { deleted: true, ...impact }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("DELETE /api/budget/subcategories/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete subcategory", success: false }, { status: 500 });
  }
}
