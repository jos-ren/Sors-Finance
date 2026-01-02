import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/budgets/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const budgetId = parseInt(id, 10);

    if (isNaN(budgetId)) {
      return NextResponse.json(
        { error: "Invalid budget ID", success: false },
        { status: 400 }
      );
    }

    // Check if budget exists
    const existing = await db
      .select()
      .from(schema.budgets)
      .where(eq(schema.budgets.id, budgetId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Budget not found", success: false },
        { status: 404 }
      );
    }

    await db.delete(schema.budgets).where(eq(schema.budgets.id, budgetId));

    return NextResponse.json({ data: { deleted: true }, success: true });
  } catch (error) {
    console.error("DELETE /api/budgets/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete budget", success: false },
      { status: 500 }
    );
  }
}
