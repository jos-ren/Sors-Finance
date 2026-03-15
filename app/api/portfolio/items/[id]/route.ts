import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import type { HistoryChange } from "@/lib/db/schema";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/portfolio/items/[id]
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

    const result = await db
      .select()
      .from(schema.portfolioItems)
      .where(
        and(
          eq(schema.portfolioItems.id, itemId),
          eq(schema.portfolioItems.userId, userId)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Item not found", success: false },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result[0], success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/portfolio/items/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch item", success: false },
      { status: 500 }
    );
  }
}

// Fields to track in history
const TRACKED_FIELDS = ["currentValue", "quantity", "pricePerUnit", "name"] as const;

// PUT /api/portfolio/items/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
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

    const body = await request.json();
    const source = body.source || "manual";
    // Strip source from updates before DB write
    const { source: _source, ...updates } = body;
    const now = new Date();

    // Fetch current item for history diff
    const [currentItem] = await db
      .select()
      .from(schema.portfolioItems)
      .where(
        and(
          eq(schema.portfolioItems.id, itemId),
          eq(schema.portfolioItems.userId, userId)
        )
      )
      .limit(1);

    const updateValues: Record<string, unknown> = { updatedAt: now };

    if (updates.name !== undefined) updateValues.name = updates.name;
    if (updates.currentValue !== undefined) updateValues.currentValue = updates.currentValue;
    if (updates.notes !== undefined) updateValues.notes = updates.notes;
    if (updates.ticker !== undefined) updateValues.ticker = updates.ticker;
    if (updates.quantity !== undefined) updateValues.quantity = updates.quantity;
    if (updates.pricePerUnit !== undefined) updateValues.pricePerUnit = updates.pricePerUnit;
    if (updates.currency !== undefined) updateValues.currency = updates.currency;
    if (updates.lastPriceUpdate !== undefined)
      updateValues.lastPriceUpdate = updates.lastPriceUpdate ? new Date(updates.lastPriceUpdate) : null;
    if (updates.priceMode !== undefined) updateValues.priceMode = updates.priceMode;
    if (updates.tickerType !== undefined) updateValues.tickerType = updates.tickerType;
    if (updates.type !== undefined) updateValues.type = updates.type;
    if (updates.isInternational !== undefined) updateValues.isInternational = updates.isInternational;
    if (updates.isActive !== undefined) updateValues.isActive = updates.isActive;

    await db
      .update(schema.portfolioItems)
      .set(updateValues)
      .where(
        and(
          eq(schema.portfolioItems.id, itemId),
          eq(schema.portfolioItems.userId, userId)
        )
      );

    // Record history if tracked fields changed (with sub-cent tolerance for numeric fields)
    if (currentItem) {
      const changes: HistoryChange[] = [];
      const NUMERIC_FIELDS = new Set(["currentValue", "quantity", "pricePerUnit"]);
      for (const field of TRACKED_FIELDS) {
        const oldVal = currentItem[field] ?? null;
        const newVal = updates[field] ?? null;
        if (newVal === undefined) continue;
        if (NUMERIC_FIELDS.has(field)) {
          if (Math.abs((Number(newVal) || 0) - (Number(oldVal) || 0)) < 0.005) continue;
        } else if (oldVal === newVal) continue;
        changes.push({ field, oldValue: oldVal, newValue: newVal });
      }

      if (changes.length > 0) {
        await db.insert(schema.portfolioItemHistory).values({
          itemId,
          source,
          type: currentItem.type || null,
          changes,
          userId,
          createdAt: now,
        });
      }
    }

    return NextResponse.json({ data: { updated: true }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("PUT /api/portfolio/items/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update item", success: false },
      { status: 500 }
    );
  }
}

// DELETE /api/portfolio/items/[id]?hard=false
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);

    const { id } = await context.params;
    const itemId = parseInt(id, 10);
    const hard = request.nextUrl.searchParams.get("hard") === "true";

    if (isNaN(itemId)) {
      return NextResponse.json(
        { error: "Invalid item ID", success: false },
        { status: 400 }
      );
    }

    // Fetch item before deleting for history
    const [currentItem] = await db
      .select()
      .from(schema.portfolioItems)
      .where(
        and(
          eq(schema.portfolioItems.id, itemId),
          eq(schema.portfolioItems.userId, userId)
        )
      )
      .limit(1);

    if (hard) {
      // Record history before hard delete (since cascade will remove history too, skip)
      await db
        .delete(schema.portfolioItems)
        .where(
          and(
            eq(schema.portfolioItems.id, itemId),
            eq(schema.portfolioItems.userId, userId)
          )
        );
    } else {
      // Soft delete (set isActive to false)
      const now = new Date();
      await db
        .update(schema.portfolioItems)
        .set({ isActive: false, updatedAt: now })
        .where(
          and(
            eq(schema.portfolioItems.id, itemId),
            eq(schema.portfolioItems.userId, userId)
          )
        );

      // Record deletion history
      if (currentItem) {
        const changes: HistoryChange[] = [
          { field: "name", oldValue: currentItem.name, newValue: null },
        ];
        if (currentItem.currentValue) {
          changes.push({ field: "currentValue", oldValue: currentItem.currentValue, newValue: null });
        }

        await db.insert(schema.portfolioItemHistory).values({
          itemId,
          source: "deleted",
          type: currentItem.type || null,
          changes,
          userId,
          createdAt: now,
        });
      }
    }

    return NextResponse.json({ data: { deleted: true }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("DELETE /api/portfolio/items/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete item", success: false },
      { status: 500 }
    );
  }
}

// PATCH /api/portfolio/items/[id] - For restore
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);

    const { id } = await context.params;
    const itemId = parseInt(id, 10);
    const { action } = await request.json();

    if (isNaN(itemId)) {
      return NextResponse.json(
        { error: "Invalid item ID", success: false },
        { status: 400 }
      );
    }

    if (action === "restore") {
      const now = new Date();
      await db
        .update(schema.portfolioItems)
        .set({ isActive: true, updatedAt: now })
        .where(
          and(
            eq(schema.portfolioItems.id, itemId),
            eq(schema.portfolioItems.userId, userId)
          )
        );

      return NextResponse.json({ data: { restored: true }, success: true });
    }

    return NextResponse.json(
      { error: "Unknown action", success: false },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("PATCH /api/portfolio/items/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to restore item", success: false },
      { status: 500 }
    );
  }
}
