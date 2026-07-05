import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { subcategoryDeleteImpact } from "@/lib/budget/hierarchy-db";

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/budget/subcategories/[id] — rename / reorder / move to another group
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

    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name !== undefined) values.name = updates.name;
    if (updates.order !== undefined) values.order = updates.order;
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

    return NextResponse.json({ data: { updated: true }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("PUT /api/budget/subcategories/[id] error:", error);
    return NextResponse.json({ error: "Failed to update subcategory", success: false }, { status: 500 });
  }
}

// DELETE /api/budget/subcategories/[id] — cascades to items; transactions become
// uncategorized. Returns affected counts.
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
