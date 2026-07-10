import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { asc, eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { normalizeKeywords } from "@/lib/categories/keyword";

// GET /api/budget/hierarchy[?includeArchived=]
// Returns two flat ordered arrays: groups, subcategories (subcategories are
// the leaf "Category" — carry keywords/type/target and archived state).
// Feeds pickers, the importer, and the builder.
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";

    const [groups, subcategories] = await Promise.all([
      db
        .select()
        .from(schema.budgetGroups)
        .where(eq(schema.budgetGroups.userId, userId))
        .orderBy(asc(schema.budgetGroups.order)),
      db
        .select()
        .from(schema.budgetSubcategories)
        .where(
          includeArchived
            ? eq(schema.budgetSubcategories.userId, userId)
            : and(eq(schema.budgetSubcategories.userId, userId), eq(schema.budgetSubcategories.isActive, true))
        )
        .orderBy(asc(schema.budgetSubcategories.order)),
    ]);

    const normalizedSubcategories = subcategories.map((sub) => ({
      ...sub,
      keywords: normalizeKeywords(sub.keywords),
    }));

    return NextResponse.json({ data: { groups, subcategories: normalizedSubcategories }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/budget/hierarchy error:", error);
    return NextResponse.json({ error: "Failed to fetch hierarchy", success: false }, { status: 500 });
  }
}
