import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

// GET /api/budgets?year=2024&month=1 — monthly budgets (item-based) for the user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const year = request.nextUrl.searchParams.get("year");
    const month = request.nextUrl.searchParams.get("month");
    if (!year || month === null || month === "") {
      return NextResponse.json({ error: "year and month are required", success: false }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(schema.budgets)
      .where(
        and(
          eq(schema.budgets.year, parseInt(year, 10)),
          eq(schema.budgets.month, parseInt(month, 10)),
          eq(schema.budgets.userId, userId)
        )
      );

    return NextResponse.json({ data: rows, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/budgets error:", error);
    return NextResponse.json({ error: "Failed to fetch budgets", success: false }, { status: 500 });
  }
}

// POST /api/budgets — upsert a monthly budget for a budget item
// Body: { budgetItemId, year, month, amount }
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const { budgetItemId, year, month, amount } = await request.json();

    if (!budgetItemId || year === undefined || month === undefined || amount === undefined) {
      return NextResponse.json(
        { error: "budgetItemId, year, month, and amount are required", success: false },
        { status: 400 }
      );
    }

    // Ownership check on the item.
    const item = await db
      .select({ id: schema.budgetItems.id })
      .from(schema.budgetItems)
      .where(and(eq(schema.budgetItems.id, budgetItemId), eq(schema.budgetItems.userId, userId)))
      .limit(1);
    if (item.length === 0) {
      return NextResponse.json({ error: "Budget item not found", success: false }, { status: 404 });
    }

    const now = new Date();
    const result = await db
      .insert(schema.budgets)
      .values({ budgetItemId, year, month, amount, userId, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [schema.budgets.budgetItemId, schema.budgets.year, schema.budgets.month, schema.budgets.userId],
        set: { amount, updatedAt: now },
      })
      .returning({ id: schema.budgets.id });

    return NextResponse.json({ data: { id: result[0].id }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("POST /api/budgets error:", error);
    return NextResponse.json({ error: "Failed to save budget", success: false }, { status: 500 });
  }
}
