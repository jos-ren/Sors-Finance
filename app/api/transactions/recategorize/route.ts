import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, ne } from "drizzle-orm";

// POST /api/transactions/recategorize
export async function POST(request: NextRequest) {
  try {
    const { mode = "uncategorized" } = await request.json();

    const now = new Date();

    // Get all categories with keywords
    const categories = await db.select().from(schema.categories);

    // Get the special categories
    const excludedCat = categories.find((c) => c.name === "Excluded");
    const uncategorizedCat = categories.find((c) => c.name === "Uncategorized");

    if (!uncategorizedCat) {
      return NextResponse.json(
        { error: "Uncategorized category not found", success: false },
        { status: 500 }
      );
    }

    // Get transactions to recategorize
    let transactions;
    if (mode === "uncategorized") {
      transactions = await db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.categoryId, uncategorizedCat.id));
    } else {
      // mode === "all" - get all non-excluded transactions
      if (excludedCat) {
        transactions = await db
          .select()
          .from(schema.transactions)
          .where(ne(schema.transactions.categoryId, excludedCat.id));
      } else {
        transactions = await db.select().from(schema.transactions);
      }
    }

    let processed = 0;
    let updated = 0;
    let conflicts = 0;

    // Categorizable categories (excluding system ones for matching)
    const matchableCategories = categories.filter(
      (c) => !c.isSystem || c.name === "Income"
    );

    for (const t of transactions) {
      processed++;
      const matchText = t.matchField.toLowerCase();

      // Find matching categories
      const matches = matchableCategories.filter((cat) =>
        cat.keywords.some((kw) => matchText.includes(kw.toLowerCase()))
      );

      if (matches.length === 1) {
        // Single match - assign
        await db
          .update(schema.transactions)
          .set({ categoryId: matches[0].id, updatedAt: now })
          .where(eq(schema.transactions.id, t.id));
        updated++;
      } else if (matches.length > 1) {
        // Multiple matches - conflict
        conflicts++;
      }
      // No matches - leave as is
    }

    return NextResponse.json({
      data: { processed, updated, conflicts },
      success: true,
    });
  } catch (error) {
    console.error("POST /api/transactions/recategorize error:", error);
    return NextResponse.json(
      { error: "Failed to recategorize transactions", success: false },
      { status: 500 }
    );
  }
}
