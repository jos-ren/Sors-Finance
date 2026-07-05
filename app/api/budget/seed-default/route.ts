import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { seedDefaultBudgetForUser } from "@/lib/db/budget-seed";

// POST /api/budget/seed-default — seed the default $5,500 starter hierarchy
// (structure + first-month amounts). No-ops if the user already has a hierarchy.
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    await seedDefaultBudgetForUser(userId, { withAmounts: true });
    return NextResponse.json({ data: { seeded: true }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("POST /api/budget/seed-default error:", error);
    return NextResponse.json({ error: "Failed to seed starter budget", success: false }, { status: 500 });
  }
}
