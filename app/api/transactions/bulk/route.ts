import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

/**
 * Normalize a date to YYYY-MM-DD format using local timezone
 * This ensures consistent duplicate detection regardless of timezone
 */
function normalizeDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// POST /api/transactions/bulk
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const { transactions, skipDuplicates = true } = await request.json();

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: "transactions array is required", success: false },
        { status: 400 }
      );
    }

    const now = new Date();
    let skippedCount = 0;
    let insertedCount = 0;

    // Build signatures for duplicate checking
    // Include source to avoid false positives across different banks
    // Use normalized date (local YYYY-MM-DD) to avoid timezone issues
    const signatures = transactions.map((t) => {
      const dateStr = normalizeDate(new Date(t.date));
      const source = t.source || "Manual";
      return `${source}|${dateStr}|${t.description}|${t.amountOut}|${t.amountIn}`;
    });

    // Check for existing duplicates if skipDuplicates is true (only for this user)
    let existingSignatures = new Set<string>();
    if (skipDuplicates) {
      const existingTransactions = await db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.userId, userId));

      existingSignatures = new Set(
        existingTransactions.map((t) => {
          const dateStr = normalizeDate(t.date);
          return `${t.source}|${dateStr}|${t.description}|${t.amountOut}|${t.amountIn}`;
        })
      );
    }

    // Filter out duplicates and prepare for insert
    const toInsert = [];
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      const sig = signatures[i];

      if (skipDuplicates && existingSignatures.has(sig)) {
        skippedCount++;
        continue;
      }

      toInsert.push({
        uuid: randomUUID(),
        date: new Date(t.date),
        description: t.description,
        matchField: t.matchField || t.description,
        amountOut: t.amountOut ?? 0,
        amountIn: t.amountIn ?? 0,
        netAmount: t.netAmount ?? (t.amountIn - t.amountOut),
        source: t.source || "Manual",
        sourceMethod: t.sourceMethod || null,
        sourceAccountName: t.sourceAccountName || null,
        categoryId: t.categoryId || null,
        importId: t.importId || null,
        userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Bulk insert in batches to avoid SQLite variable limit
    // 15 columns per row, SQLite max 999 variables = 66 rows per batch (use 50 for safety)
    const BATCH_SIZE = 50;
    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        await db.insert(schema.transactions).values(batch);
      }
      insertedCount = toInsert.length;
    }

    return NextResponse.json({
      data: {
        inserted: insertedCount,
        skipped: skippedCount,
        total: transactions.length,
      },
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("POST /api/transactions/bulk error:", message, error);
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}
