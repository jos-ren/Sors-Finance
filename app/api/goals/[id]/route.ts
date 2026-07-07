import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { getGoalSummaries } from "@/lib/budget/goals-db";
import type { GoalDetail } from "@/lib/budget/types";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/goals/[id]?year=&month= — one GoalSummary plus its per-month
// allocation history (for the contribution chart). Linked transactions are
// fetched separately via the existing transactions API.
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);
    const { id } = await context.params;
    const goalId = parseInt(id, 10);
    if (isNaN(goalId)) {
      return NextResponse.json({ error: "Invalid goal ID", success: false }, { status: 400 });
    }
    const yearParam = request.nextUrl.searchParams.get("year");
    const monthParam = request.nextUrl.searchParams.get("month");
    if (yearParam === null || monthParam === null) {
      return NextResponse.json({ error: "year and month are required", success: false }, { status: 400 });
    }
    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10);

    const summaries = await getGoalSummaries(userId, year, month);
    const summary = summaries.find((g) => g.id === goalId);
    if (!summary) {
      return NextResponse.json({ error: "Goal not found", success: false }, { status: 404 });
    }

    const contributions = await db
      .select({
        year: schema.budgets.year,
        month: schema.budgets.month,
        amount: schema.budgets.amount,
      })
      .from(schema.budgets)
      .where(and(eq(schema.budgets.userId, userId), eq(schema.budgets.budgetItemId, goalId)))
      .orderBy(asc(schema.budgets.year), asc(schema.budgets.month));

    const detail: GoalDetail = { ...summary, contributions };
    return NextResponse.json({ data: detail, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/goals/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch goal", success: false }, { status: 500 });
  }
}
