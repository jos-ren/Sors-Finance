import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/portfolio/items/[id]/history
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);

    const { id } = await context.params;
    const itemId = parseInt(id, 10);

    if (isNaN(itemId)) {
      return NextResponse.json(
        { error: "Invalid item ID", success: false },
        { status: 400 }
      );
    }

    // Verify item belongs to user
    const [item] = await db
      .select({ id: schema.portfolioItems.id })
      .from(schema.portfolioItems)
      .where(
        and(
          eq(schema.portfolioItems.id, itemId),
          eq(schema.portfolioItems.userId, userId)
        )
      )
      .limit(1);

    if (!item) {
      return NextResponse.json(
        { error: "Item not found", success: false },
        { status: 404 }
      );
    }

    const history = await db
      .select()
      .from(schema.portfolioItemHistory)
      .where(eq(schema.portfolioItemHistory.itemId, itemId))
      .orderBy(desc(schema.portfolioItemHistory.createdAt))
      .limit(50);

    return NextResponse.json({ data: history, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/portfolio/items/[id]/history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch item history", success: false },
      { status: 500 }
    );
  }
}
