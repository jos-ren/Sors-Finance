import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { asc, sql, eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

// GET /api/budget/subcategories[?groupId=&includeArchived=]
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const groupId = request.nextUrl.searchParams.get("groupId");
    const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";

    const conditions = [eq(schema.budgetSubcategories.userId, userId)];
    if (groupId) conditions.push(eq(schema.budgetSubcategories.groupId, parseInt(groupId, 10)));
    if (!includeArchived) conditions.push(eq(schema.budgetSubcategories.isActive, true));

    const rows = await db
      .select()
      .from(schema.budgetSubcategories)
      .where(and(...conditions))
      .orderBy(asc(schema.budgetSubcategories.order));
    return NextResponse.json({ data: rows, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/budget/subcategories error:", error);
    return NextResponse.json({ error: "Failed to fetch subcategories", success: false }, { status: 500 });
  }
}

// POST /api/budget/subcategories — create under a group
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const { name, groupId, keywords = [], itemType = "expense", targetAmount = null, targetDate = null } = await request.json();
    if (!name || !groupId) {
      return NextResponse.json({ error: "name and groupId are required", success: false }, { status: 400 });
    }

    // Ownership check on the parent group
    const group = await db
      .select({ id: schema.budgetGroups.id })
      .from(schema.budgetGroups)
      .where(and(eq(schema.budgetGroups.id, groupId), eq(schema.budgetGroups.userId, userId)))
      .limit(1);
    if (group.length === 0) {
      return NextResponse.json({ error: "Group not found", success: false }, { status: 404 });
    }

    const maxOrder = await db
      .select({ maxOrder: sql<number>`MAX(${schema.budgetSubcategories.order})` })
      .from(schema.budgetSubcategories)
      .where(and(eq(schema.budgetSubcategories.userId, userId), eq(schema.budgetSubcategories.groupId, groupId)));
    const order = (maxOrder[0]?.maxOrder ?? -1) + 1;
    const now = new Date();

    const result = await db
      .insert(schema.budgetSubcategories)
      .values({
        uuid: randomUUID(),
        name,
        groupId,
        keywords,
        itemType: itemType === "goal" ? "goal" : "expense",
        targetAmount,
        targetDate: targetDate != null ? new Date(targetDate) : null,
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
    console.error("POST /api/budget/subcategories error:", error);
    return NextResponse.json({ error: "Failed to create subcategory", success: false }, { status: 500 });
  }
}
