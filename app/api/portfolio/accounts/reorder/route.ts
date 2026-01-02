import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, asc } from "drizzle-orm";

// POST /api/portfolio/accounts/reorder
export async function POST(request: NextRequest) {
  try {
    const { bucket, activeId, overId } = await request.json();

    if (!bucket || !activeId || !overId) {
      return NextResponse.json(
        { error: "bucket, activeId, and overId are required", success: false },
        { status: 400 }
      );
    }

    // Get all accounts for this bucket
    const accounts = await db
      .select()
      .from(schema.portfolioAccounts)
      .where(eq(schema.portfolioAccounts.bucket, bucket))
      .orderBy(asc(schema.portfolioAccounts.order));

    // Find indices
    const activeIndex = accounts.findIndex((a) => a.id === activeId);
    const overIndex = accounts.findIndex((a) => a.id === overId);

    if (activeIndex === -1 || overIndex === -1) {
      return NextResponse.json(
        { error: "Account not found", success: false },
        { status: 404 }
      );
    }

    // Reorder array
    const [movedAccount] = accounts.splice(activeIndex, 1);
    accounts.splice(overIndex, 0, movedAccount);

    // Update order values
    const now = new Date();
    for (let i = 0; i < accounts.length; i++) {
      await db
        .update(schema.portfolioAccounts)
        .set({ order: i, updatedAt: now })
        .where(eq(schema.portfolioAccounts.id, accounts[i].id));
    }

    return NextResponse.json({ data: { reordered: true }, success: true });
  } catch (error) {
    console.error("POST /api/portfolio/accounts/reorder error:", error);
    return NextResponse.json(
      { error: "Failed to reorder accounts", success: false },
      { status: 500 }
    );
  }
}
