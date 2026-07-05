import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { groupDeleteImpact } from "@/lib/budget/hierarchy-db";

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/budget/groups/[id] — rename / reorder
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);
    const { id } = await context.params;
    const groupId = parseInt(id, 10);
    if (isNaN(groupId)) {
      return NextResponse.json({ error: "Invalid group ID", success: false }, { status: 400 });
    }

    const updates = await request.json();
    const existing = await db
      .select()
      .from(schema.budgetGroups)
      .where(and(eq(schema.budgetGroups.id, groupId), eq(schema.budgetGroups.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Group not found", success: false }, { status: 404 });
    }

    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name !== undefined) values.name = updates.name;
    if (updates.order !== undefined) values.order = updates.order;

    await db
      .update(schema.budgetGroups)
      .set(values)
      .where(and(eq(schema.budgetGroups.id, groupId), eq(schema.budgetGroups.userId, userId)));

    return NextResponse.json({ data: { updated: true }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("PUT /api/budget/groups/[id] error:", error);
    return NextResponse.json({ error: "Failed to update group", success: false }, { status: 500 });
  }
}

// DELETE /api/budget/groups/[id] — cascades to subs+items; transactions become
// uncategorized (FK set null). Returns affected counts so the UI can warn.
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);
    const { id } = await context.params;
    const groupId = parseInt(id, 10);
    if (isNaN(groupId)) {
      return NextResponse.json({ error: "Invalid group ID", success: false }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(schema.budgetGroups)
      .where(and(eq(schema.budgetGroups.id, groupId), eq(schema.budgetGroups.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Group not found", success: false }, { status: 404 });
    }

    const impact = await groupDeleteImpact(userId, groupId);

    await db
      .delete(schema.budgetGroups)
      .where(and(eq(schema.budgetGroups.id, groupId), eq(schema.budgetGroups.userId, userId)));

    return NextResponse.json({ data: { deleted: true, ...impact }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("DELETE /api/budget/groups/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete group", success: false }, { status: 500 });
  }
}
