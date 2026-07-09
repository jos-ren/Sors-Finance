import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

// DELETE /api/keywords?all=true - clear keywords from every category and
// subcategory for the authenticated user. Categories and budgets are kept.
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    if (request.nextUrl.searchParams.get("all") !== "true") {
      return NextResponse.json({ error: "all=true is required", success: false }, { status: 400 });
    }

    const now = new Date();

    const [categoryResult, subcategoryResult] = await Promise.all([
      db
        .update(schema.categories)
        .set({ keywords: [], updatedAt: now })
        .where(eq(schema.categories.userId, userId))
        .returning({ id: schema.categories.id }),
      db
        .update(schema.budgetSubcategories)
        .set({ keywords: [], updatedAt: now })
        .where(eq(schema.budgetSubcategories.userId, userId))
        .returning({ id: schema.budgetSubcategories.id }),
    ]);

    return NextResponse.json({
      data: { cleared: categoryResult.length + subcategoryResult.length },
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("DELETE /api/keywords error:", error);
    return NextResponse.json({ error: "Failed to delete keywords", success: false }, { status: 500 });
  }
}
