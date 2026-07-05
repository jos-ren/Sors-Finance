import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { asc, eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

// GET /api/budget/hierarchy[?includeArchived=]
// Returns three flat ordered arrays: groups, subcategories, items.
// Feeds pickers, the importer, and manage mode.
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";

    const [groups, subcategories, items] = await Promise.all([
      db
        .select()
        .from(schema.budgetGroups)
        .where(eq(schema.budgetGroups.userId, userId))
        .orderBy(asc(schema.budgetGroups.order)),
      db
        .select()
        .from(schema.budgetSubcategories)
        .where(eq(schema.budgetSubcategories.userId, userId))
        .orderBy(asc(schema.budgetSubcategories.order)),
      db
        .select()
        .from(schema.budgetItems)
        .where(
          includeArchived
            ? eq(schema.budgetItems.userId, userId)
            : and(eq(schema.budgetItems.userId, userId), eq(schema.budgetItems.isActive, true))
        )
        .orderBy(asc(schema.budgetItems.order)),
    ]);

    return NextResponse.json({ data: { groups, subcategories, items }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/budget/hierarchy error:", error);
    return NextResponse.json({ error: "Failed to fetch hierarchy", success: false }, { status: 500 });
  }
}
