import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, isNull, or } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/categories/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);
    const { id } = await context.params;
    const categoryId = parseInt(id, 10);
    if (isNaN(categoryId)) {
      return NextResponse.json({ error: "Invalid category ID", success: false }, { status: 400 });
    }

    const result = await db
      .select()
      .from(schema.categories)
      .where(and(eq(schema.categories.id, categoryId), eq(schema.categories.userId, userId)))
      .limit(1);
    if (result.length === 0) {
      return NextResponse.json({ error: "Category not found", success: false }, { status: 404 });
    }

    const row = result[0];
    return NextResponse.json({
      data: {
        id: row.id,
        uuid: row.uuid,
        name: row.name,
        keywords: row.keywords,
        order: row.order,
        isSystem: row.isSystem ?? false,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/categories/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch category", success: false }, { status: 500 });
  }
}

// PUT /api/categories/[id] — only keyword edits on system categories are
// supported now (in practice, the Income category). Names are immutable.
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);
    const { id } = await context.params;
    const categoryId = parseInt(id, 10);
    if (isNaN(categoryId)) {
      return NextResponse.json({ error: "Invalid category ID", success: false }, { status: 400 });
    }

    const updates = await request.json();

    const existing = await db
      .select()
      .from(schema.categories)
      .where(and(eq(schema.categories.id, categoryId), eq(schema.categories.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Category not found", success: false }, { status: 404 });
    }

    if (updates.keywords === undefined) {
      return NextResponse.json({ error: "Only keyword edits are supported", success: false }, { status: 400 });
    }

    const now = new Date();
    await db
      .update(schema.categories)
      .set({ keywords: updates.keywords, updatedAt: now })
      .where(and(eq(schema.categories.id, categoryId), eq(schema.categories.userId, userId)));

    // Recategorize currently-uncategorized transactions matching the new keywords
    // to this (system) category.
    const result = { assigned: 0 };
    const uncategorizedCat = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(and(eq(schema.categories.name, "Uncategorized"), eq(schema.categories.userId, userId)))
      .limit(1);
    const uncatId = uncategorizedCat[0]?.id;

    const candidates = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          isNull(schema.transactions.budgetItemId),
          eq(schema.transactions.categoryLocked, false),
          uncatId
            ? or(isNull(schema.transactions.categoryId), eq(schema.transactions.categoryId, uncatId))
            : isNull(schema.transactions.categoryId)
        )
      );

    const keywords = (updates.keywords as string[]).map((k) => k.toLowerCase());
    for (const t of candidates) {
      const text = t.matchField.toLowerCase();
      if (keywords.some((kw) => text.includes(kw))) {
        await db
          .update(schema.transactions)
          .set({ categoryId, budgetItemId: null, updatedAt: now })
          .where(and(eq(schema.transactions.id, t.id), eq(schema.transactions.userId, userId)));
        result.assigned++;
      }
    }

    return NextResponse.json({ data: result, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("PUT /api/categories/[id] error:", error);
    return NextResponse.json({ error: "Failed to update category", success: false }, { status: 500 });
  }
}
