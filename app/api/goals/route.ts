import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { getGoalSummaries } from "@/lib/budget/goals-db";

// GET /api/goals?year=&month= — every goal category as a GoalSummary
// (lifetime contributed/spent/available; year/month give the "current"
// period for thisMonthContributed and pace, 0-based month).
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const yearParam = request.nextUrl.searchParams.get("year");
    const monthParam = request.nextUrl.searchParams.get("month");
    if (yearParam === null || monthParam === null) {
      return NextResponse.json({ error: "year and month are required", success: false }, { status: 400 });
    }
    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10);

    const goals = await getGoalSummaries(userId, year, month);
    return NextResponse.json({ data: goals, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/goals error:", error);
    return NextResponse.json({ error: "Failed to fetch goals", success: false }, { status: 500 });
  }
}
