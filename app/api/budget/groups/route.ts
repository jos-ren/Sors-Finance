import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { asc, sql, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

// GET /api/budget/groups — list groups for the user (ordered)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const rows = await db
      .select()
      .from(schema.budgetGroups)
      .where(eq(schema.budgetGroups.userId, userId))
      .orderBy(asc(schema.budgetGroups.order));
    return NextResponse.json({ data: rows, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/budget/groups error:", error);
    return NextResponse.json({ error: "Failed to fetch budget groups", success: false }, { status: 500 });
  }
}

// POST /api/budget/groups — create a group
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: "Name is required", success: false }, { status: 400 });
    }

    const maxOrder = await db
      .select({ maxOrder: sql<number>`MAX(${schema.budgetGroups.order})` })
      .from(schema.budgetGroups)
      .where(eq(schema.budgetGroups.userId, userId));
    const order = (maxOrder[0]?.maxOrder ?? -1) + 1;
    const now = new Date();

    const result = await db
      .insert(schema.budgetGroups)
      .values({ uuid: randomUUID(), name, order, userId, createdAt: now, updatedAt: now })
      .returning();

    return NextResponse.json({ data: result[0], success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("POST /api/budget/groups error:", error);
    return NextResponse.json({ error: "Failed to create budget group", success: false }, { status: 500 });
  }
}
