import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, isNull, or } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { itemDeleteImpact } from "@/lib/budget/hierarchy-db";

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/budget/items/[id] — rename, reorder, move (subcategoryId), keywords,
// itemType, targetAmount, isActive (archive/restore). Keyword changes assign
// matching currently-uncategorized transactions to this item.
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);
    const { id } = await context.params;
    const itemId = parseInt(id, 10);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: "Invalid item ID", success: false }, { status: 400 });
    }

    const updates = await request.json();
    const existing = await db
      .select()
      .from(schema.budgetItems)
      .where(and(eq(schema.budgetItems.id, itemId), eq(schema.budgetItems.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Item not found", success: false }, { status: 404 });
    }

    const now = new Date();
    const values: Record<string, unknown> = { updatedAt: now };
    if (updates.name !== undefined) values.name = updates.name;
    if (updates.order !== undefined) values.order = updates.order;
    if (updates.keywords !== undefined) values.keywords = updates.keywords;
    if (updates.targetAmount !== undefined) values.targetAmount = updates.targetAmount;
    if (updates.isActive !== undefined) values.isActive = updates.isActive;
    if (updates.itemType !== undefined) values.itemType = updates.itemType === "goal" ? "goal" : "expense";
    if (updates.subcategoryId !== undefined) {
      const sub = await db
        .select({ id: schema.budgetSubcategories.id })
        .from(schema.budgetSubcategories)
        .where(and(eq(schema.budgetSubcategories.id, updates.subcategoryId), eq(schema.budgetSubcategories.userId, userId)))
        .limit(1);
      if (sub.length === 0) {
        return NextResponse.json({ error: "Target subcategory not found", success: false }, { status: 400 });
      }
      values.subcategoryId = updates.subcategoryId;
    }

    await db
      .update(schema.budgetItems)
      .set(values)
      .where(and(eq(schema.budgetItems.id, itemId), eq(schema.budgetItems.userId, userId)));

    // On keyword change, assign matching uncategorized transactions to this item.
    const result = { assigned: 0 };
    if (updates.keywords !== undefined && Array.isArray(updates.keywords)) {
      const uncategorizedCat = await db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(and(eq(schema.categories.name, "Uncategorized"), eq(schema.categories.userId, userId)))
        .limit(1);
      const uncatId = uncategorizedCat[0]?.id;

      // Currently-unassigned: no budget item AND (no category or the Uncategorized system category),
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

      const keywords = (updates.keywords as string[]).map((k) => k.toLowerCase());
      for (const t of candidates) {
        const text = t.matchField.toLowerCase();
        if (keywords.some((kw) => text.includes(kw))) {
          await db
            .update(schema.transactions)
            .set({ budgetItemId: itemId, categoryId: null, updatedAt: now })
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
    console.error("PUT /api/budget/items/[id] error:", error);
    return NextResponse.json({ error: "Failed to update item", success: false }, { status: 500 });
  }
}

// DELETE /api/budget/items/[id] — cascades budgets; transactions become
// uncategorized (FK set null). Returns affected counts.
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);
    const { id } = await context.params;
    const itemId = parseInt(id, 10);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: "Invalid item ID", success: false }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(schema.budgetItems)
      .where(and(eq(schema.budgetItems.id, itemId), eq(schema.budgetItems.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Item not found", success: false }, { status: 404 });
    }

    const impact = await itemDeleteImpact(userId, itemId);

    await db
      .delete(schema.budgetItems)
      .where(and(eq(schema.budgetItems.id, itemId), eq(schema.budgetItems.userId, userId)));

    return NextResponse.json({ data: { deleted: true, ...impact }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("DELETE /api/budget/items/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete item", success: false }, { status: 500 });
  }
}
