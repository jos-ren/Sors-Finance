import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, isNull } from "drizzle-orm";

// GET /api/budgets?year=2024&month=1
export async function GET(request: NextRequest) {
  try {
    const year = request.nextUrl.searchParams.get("year");
    const month = request.nextUrl.searchParams.get("month");

    if (!year) {
      return NextResponse.json(
        { error: "Year is required", success: false },
        { status: 400 }
      );
    }

    const yearNum = parseInt(year, 10);
    let results;

    if (month === null || month === "null" || month === "") {
      // Get yearly budgets (month is null)
      results = await db
        .select()
        .from(schema.budgets)
        .where(and(eq(schema.budgets.year, yearNum), isNull(schema.budgets.month)));
    } else {
      // Get monthly budgets
      const monthNum = parseInt(month, 10);
      results = await db
        .select()
        .from(schema.budgets)
        .where(and(eq(schema.budgets.year, yearNum), eq(schema.budgets.month, monthNum)));
    }

    const budgets = results.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      year: row.year,
      month: row.month,
      amount: row.amount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return NextResponse.json({ data: budgets, success: true });
  } catch (error) {
    console.error("GET /api/budgets error:", error);
    return NextResponse.json(
      { error: "Failed to fetch budgets", success: false },
      { status: 500 }
    );
  }
}

// POST /api/budgets (upsert)
export async function POST(request: NextRequest) {
  try {
    const { categoryId, year, month, amount } = await request.json();

    if (!categoryId || !year || amount === undefined) {
      return NextResponse.json(
        { error: "categoryId, year, and amount are required", success: false },
        { status: 400 }
      );
    }

    const now = new Date();
    const monthValue = month === null || month === undefined ? null : month;

    // Check if budget exists
    let existing;
    if (monthValue === null) {
      existing = await db
        .select()
        .from(schema.budgets)
        .where(
          and(
            eq(schema.budgets.categoryId, categoryId),
            eq(schema.budgets.year, year),
            isNull(schema.budgets.month)
          )
        )
        .limit(1);
    } else {
      existing = await db
        .select()
        .from(schema.budgets)
        .where(
          and(
            eq(schema.budgets.categoryId, categoryId),
            eq(schema.budgets.year, year),
            eq(schema.budgets.month, monthValue)
          )
        )
        .limit(1);
    }

    let budgetId: number;

    if (existing.length > 0) {
      // Update existing
      await db
        .update(schema.budgets)
        .set({ amount, updatedAt: now })
        .where(eq(schema.budgets.id, existing[0].id));
      budgetId = existing[0].id;
    } else {
      // Create new
      const result = await db
        .insert(schema.budgets)
        .values({
          categoryId,
          year,
          month: monthValue,
          amount,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schema.budgets.id });
      budgetId = result[0].id;
    }

    return NextResponse.json({ data: { id: budgetId }, success: true });
  } catch (error) {
    console.error("POST /api/budgets error:", error);
    return NextResponse.json(
      { error: "Failed to save budget", success: false },
      { status: 500 }
    );
  }
}
