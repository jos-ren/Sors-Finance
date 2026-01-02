import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/portfolio/snapshots/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const snapshotId = parseInt(id, 10);

    if (isNaN(snapshotId)) {
      return NextResponse.json(
        { error: "Invalid snapshot ID", success: false },
        { status: 400 }
      );
    }

    const result = await db
      .select()
      .from(schema.portfolioSnapshots)
      .where(eq(schema.portfolioSnapshots.id, snapshotId))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Snapshot not found", success: false },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result[0], success: true });
  } catch (error) {
    console.error("GET /api/portfolio/snapshots/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch snapshot", success: false },
      { status: 500 }
    );
  }
}

// PUT /api/portfolio/snapshots/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const snapshotId = parseInt(id, 10);

    if (isNaN(snapshotId)) {
      return NextResponse.json(
        { error: "Invalid snapshot ID", success: false },
        { status: 400 }
      );
    }

    const updates = await request.json();

    const updateValues: Record<string, unknown> = {};

    if (updates.totalSavings !== undefined) updateValues.totalSavings = updates.totalSavings;
    if (updates.totalInvestments !== undefined) updateValues.totalInvestments = updates.totalInvestments;
    if (updates.totalAssets !== undefined) updateValues.totalAssets = updates.totalAssets;
    if (updates.totalDebt !== undefined) updateValues.totalDebt = updates.totalDebt;

    // Recalculate net worth if any bucket value changed
    if (Object.keys(updateValues).length > 0) {
      const existing = await db
        .select()
        .from(schema.portfolioSnapshots)
        .where(eq(schema.portfolioSnapshots.id, snapshotId))
        .limit(1);

      if (existing.length === 0) {
        return NextResponse.json(
          { error: "Snapshot not found", success: false },
          { status: 404 }
        );
      }

      const snapshot = existing[0];
      const savings = updates.totalSavings ?? snapshot.totalSavings;
      const investments = updates.totalInvestments ?? snapshot.totalInvestments;
      const assets = updates.totalAssets ?? snapshot.totalAssets;
      const debt = updates.totalDebt ?? snapshot.totalDebt;

      updateValues.netWorth = savings + investments + assets - debt;
    }

    await db
      .update(schema.portfolioSnapshots)
      .set(updateValues)
      .where(eq(schema.portfolioSnapshots.id, snapshotId));

    return NextResponse.json({ data: { updated: true }, success: true });
  } catch (error) {
    console.error("PUT /api/portfolio/snapshots/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update snapshot", success: false },
      { status: 500 }
    );
  }
}

// DELETE /api/portfolio/snapshots/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const snapshotId = parseInt(id, 10);

    if (isNaN(snapshotId)) {
      return NextResponse.json(
        { error: "Invalid snapshot ID", success: false },
        { status: 400 }
      );
    }

    await db
      .delete(schema.portfolioSnapshots)
      .where(eq(schema.portfolioSnapshots.id, snapshotId));

    return NextResponse.json({ data: { deleted: true }, success: true });
  } catch (error) {
    console.error("DELETE /api/portfolio/snapshots/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete snapshot", success: false },
      { status: 500 }
    );
  }
}
