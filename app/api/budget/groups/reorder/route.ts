import { NextRequest, NextResponse } from "next/server";
import { schema } from "@/lib/db/connection";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { reorderWithinScope } from "@/lib/budget/hierarchy-db";

// POST /api/budget/groups/reorder
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const { activeId, overId } = await request.json();
    if (!activeId || !overId) {
      return NextResponse.json({ error: "activeId and overId are required", success: false }, { status: 400 });
    }
    const ok = await reorderWithinScope(schema.budgetGroups, userId, activeId, overId);
    if (!ok) {
      return NextResponse.json({ error: "Group not found", success: false }, { status: 404 });
    }
    return NextResponse.json({ data: { reordered: true }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("POST /api/budget/groups/reorder error:", error);
    return NextResponse.json({ error: "Failed to reorder groups", success: false }, { status: 500 });
  }
}
