import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, asc } from "drizzle-orm";

// POST /api/portfolio/items/reorder
export async function POST(request: NextRequest) {
  try {
    const { accountId, activeId, overId } = await request.json();

    if (!accountId || !activeId || !overId) {
      return NextResponse.json(
        { error: "accountId, activeId, and overId are required", success: false },
        { status: 400 }
      );
    }

    // Get all items for this account
    const items = await db
      .select()
      .from(schema.portfolioItems)
      .where(eq(schema.portfolioItems.accountId, accountId))
      .orderBy(asc(schema.portfolioItems.order));

    // Find indices
    const activeIndex = items.findIndex((i) => i.id === activeId);
    const overIndex = items.findIndex((i) => i.id === overId);

    if (activeIndex === -1 || overIndex === -1) {
      return NextResponse.json(
        { error: "Item not found", success: false },
        { status: 404 }
      );
    }

    // Reorder array
    const [movedItem] = items.splice(activeIndex, 1);
    items.splice(overIndex, 0, movedItem);

    // Update order values
    const now = new Date();
    for (let i = 0; i < items.length; i++) {
      await db
        .update(schema.portfolioItems)
        .set({ order: i, updatedAt: now })
        .where(eq(schema.portfolioItems.id, items[i].id));
    }

    return NextResponse.json({ data: { reordered: true }, success: true });
  } catch (error) {
    console.error("POST /api/portfolio/items/reorder error:", error);
    return NextResponse.json(
      { error: "Failed to reorder items", success: false },
      { status: 500 }
    );
  }
}
