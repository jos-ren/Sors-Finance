import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

// GET /api/budgets/income?year=2024&month=1 — planned income for the user's month
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
      .from(schema.plannedIncome)
      .where(
        and(
          eq(schema.plannedIncome.year, parseInt(year, 10)),
          eq(schema.plannedIncome.month, parseInt(month, 10)),
          eq(schema.plannedIncome.userId, userId)
        )
      )
      .limit(1);

    return NextResponse.json({ data: rows[0] ?? null, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/budgets/income error:", error);
    return NextResponse.json({ error: "Failed to fetch planned income", success: false }, { status: 500 });
  }
}

// POST /api/budgets/income — upsert the planned income for a month
// Body: { year, month, amount }
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const { year, month, amount } = await request.json();

    if (year === undefined || month === undefined || amount === undefined) {
      return NextResponse.json(
        { error: "year, month, and amount are required", success: false },
        { status: 400 }
      );
    }

    const now = new Date();
    const result = await db
      .insert(schema.plannedIncome)
      .values({ year, month, amount, userId, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [schema.plannedIncome.year, schema.plannedIncome.month, schema.plannedIncome.userId],
        set: { amount, updatedAt: now },
      })
      .returning({ id: schema.plannedIncome.id });

    return NextResponse.json({ data: { id: result[0].id }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("POST /api/budgets/income error:", error);
    return NextResponse.json({ error: "Failed to save planned income", success: false }, { status: 500 });
  }
}
