import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

// POST /api/budgets/copy — copy monthly budgets from one period to another.
// Body: { fromYear, fromMonth, toYear, toMonth }. Skips inactive items and does
// not overwrite existing target rows (ON CONFLICT DO NOTHING).
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const { fromYear, fromMonth, toYear, toMonth } = await request.json();

    if (
      fromYear === undefined ||
      fromMonth === undefined ||
      toYear === undefined ||
      toMonth === undefined
    ) {
      return NextResponse.json(
        { error: "fromYear, fromMonth, toYear, toMonth are required", success: false },
        { status: 400 }
      );
    }

    // Source budgets joined with items so we can skip inactive items.
    const sourceBudgets = await db
      .select({
        budgetItemId: schema.budgets.budgetItemId,
        amount: schema.budgets.amount,
        isActive: schema.budgetItems.isActive,
      })
      .from(schema.budgets)
      .innerJoin(schema.budgetItems, eq(schema.budgets.budgetItemId, schema.budgetItems.id))
      .where(
        and(
          eq(schema.budgets.year, fromYear),
          eq(schema.budgets.month, fromMonth),
          eq(schema.budgets.userId, userId)
        )
      );

    const now = new Date();
    let copied = 0;

    for (const b of sourceBudgets) {
      if (!b.isActive) continue;
      const res = await db
        .insert(schema.budgets)
        .values({
          budgetItemId: b.budgetItemId,
          year: toYear,
          month: toMonth,
          amount: b.amount,
          userId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: [schema.budgets.budgetItemId, schema.budgets.year, schema.budgets.month, schema.budgets.userId],
        })
        .returning({ id: schema.budgets.id });
      if (res.length > 0) copied++;
    }

    return NextResponse.json({ data: { copied }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("POST /api/budgets/copy error:", error);
    return NextResponse.json({ error: "Failed to copy budgets", success: false }, { status: 500 });
  }
}
