import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { asc, sql, eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

// GET /api/budget/items[?subcategoryId=&includeArchived=]
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const subcategoryId = request.nextUrl.searchParams.get("subcategoryId");
    const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";

    const conditions = [eq(schema.budgetItems.userId, userId)];
    if (subcategoryId) conditions.push(eq(schema.budgetItems.subcategoryId, parseInt(subcategoryId, 10)));
    if (!includeArchived) conditions.push(eq(schema.budgetItems.isActive, true));

    const rows = await db
      .select()
      .from(schema.budgetItems)
      .where(and(...conditions))
      .orderBy(asc(schema.budgetItems.order));
    return NextResponse.json({ data: rows, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/budget/items error:", error);
    return NextResponse.json({ error: "Failed to fetch budget items", success: false }, { status: 500 });
  }
}

// POST /api/budget/items — create under a subcategory
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const { name, subcategoryId, keywords = [], itemType = "expense", targetAmount = null } = await request.json();
    if (!name || !subcategoryId) {
      return NextResponse.json({ error: "name and subcategoryId are required", success: false }, { status: 400 });
    }

    const sub = await db
      .select({ id: schema.budgetSubcategories.id })
      .from(schema.budgetSubcategories)
      .where(and(eq(schema.budgetSubcategories.id, subcategoryId), eq(schema.budgetSubcategories.userId, userId)))
      .limit(1);
    if (sub.length === 0) {
      return NextResponse.json({ error: "Subcategory not found", success: false }, { status: 404 });
    }

    const maxOrder = await db
      .select({ maxOrder: sql<number>`MAX(${schema.budgetItems.order})` })
      .from(schema.budgetItems)
      .where(and(eq(schema.budgetItems.userId, userId), eq(schema.budgetItems.subcategoryId, subcategoryId)));
    const order = (maxOrder[0]?.maxOrder ?? -1) + 1;
    const now = new Date();

    const result = await db
      .insert(schema.budgetItems)
      .values({
        uuid: randomUUID(),
        name,
        subcategoryId,
        keywords,
        itemType: itemType === "goal" ? "goal" : "expense",
        targetAmount,
        isActive: true,
        order,
        userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return NextResponse.json({ data: result[0], success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("POST /api/budget/items error:", error);
    return NextResponse.json({ error: "Failed to create budget item", success: false }, { status: 500 });
  }
}
