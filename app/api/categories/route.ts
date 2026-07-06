import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { asc, eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

// GET /api/categories — the three system categories (Income / Excluded /
// Uncategorized). User categories no longer exist; budgeting uses the hierarchy.
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const results = await db
      .select()
      .from(schema.categories)
      .where(and(eq(schema.categories.userId, userId), eq(schema.categories.isSystem, true)))
      .orderBy(asc(schema.categories.order));

    const categories = results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      name: row.name,
      keywords: row.keywords,
      order: row.order,
      isSystem: row.isSystem ?? false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return NextResponse.json({ data: categories, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/categories error:", error);
    return NextResponse.json({ error: "Failed to fetch categories", success: false }, { status: 500 });
  }
}
