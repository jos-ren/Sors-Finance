import { NextRequest, NextResponse } from "next/server";
import { schema } from "@/lib/db/connection";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { reorderWithinScope } from "@/lib/budget/hierarchy-db";

// POST /api/budget/items/reorder — reorder within a subcategory
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const { activeId, overId, subcategoryId } = await request.json();
    if (!activeId || !overId) {
      return NextResponse.json({ error: "activeId and overId are required", success: false }, { status: 400 });
    }
    const parent = subcategoryId ? ({ column: "subcategoryId" as const, id: subcategoryId }) : undefined;
    const ok = await reorderWithinScope(schema.budgetItems, userId, activeId, overId, parent);
    if (!ok) {
      return NextResponse.json({ error: "Item not found", success: false }, { status: 404 });
    }
    return NextResponse.json({ data: { reordered: true }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("POST /api/budget/items/reorder error:", error);
    return NextResponse.json({ error: "Failed to reorder items", success: false }, { status: 500 });
  }
}
