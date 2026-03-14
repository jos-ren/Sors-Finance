import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { asc, sql, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

// GET /api/categories
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const results = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.userId, userId))
      .orderBy(asc(schema.categories.order));

    // Convert to match DbCategory interface
    const categories = results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      name: row.name,
      keywords: row.keywords,
      order: row.order,
      isSystem: row.isSystem ?? false,
      excludeFromBudget: row.excludeFromBudget ?? false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return NextResponse.json({ data: categories, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/categories error:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories", success: false },
      { status: 500 }
    );
  }
}

// POST /api/categories
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const { name, keywords = [] } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "Name is required", success: false },
        { status: 400 }
      );
    }

    // Get max order for this user
    const maxOrderResult = await db
      .select({ maxOrder: sql<number>`MAX(${schema.categories.order})` })
      .from(schema.categories)
      .where(eq(schema.categories.userId, userId));

    const order = (maxOrderResult[0]?.maxOrder ?? -1) + 1;
    const now = new Date();

    const result = await db
      .insert(schema.categories)
      .values({
        uuid: randomUUID(),
        name,
        keywords,
        order,
        isSystem: false,
        userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: schema.categories.id });

    return NextResponse.json({ data: { id: result[0].id }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/categories error:", error);
    return NextResponse.json(
      { error: "Failed to create category", success: false },
      { status: 500 }
    );
  }
}
