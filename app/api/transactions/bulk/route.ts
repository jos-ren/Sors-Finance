import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { and, eq, isNotNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { normalizeAssignment } from "@/lib/budget/normalize-assignment";

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

    // Project ids (from project keywords on import) must belong to this user
    const ownedProjectIds = new Set(
      (
        await db
          .select({ id: schema.projects.id })
          .from(schema.projects)
          .where(and(eq(schema.projects.userId, userId), eq(schema.projects.isArchived, false)))
      ).map((p) => p.id)
    );
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

    // Plaid rows dedup on their transaction id instead: two identical coffees
    // on the same day are two transactions, not a duplicate.
    const existingPlaidIds = new Set(
      (
        await db
          .select({ plaidTransactionId: schema.transactions.plaidTransactionId })
          .from(schema.transactions)
          .where(and(eq(schema.transactions.userId, userId), isNotNull(schema.transactions.plaidTransactionId)))
      ).map((r) => r.plaidTransactionId!)
    );

    // Filter out duplicates and prepare for insert. `insertedIndexes` keeps each
    // inserted row's position in the request so callers can map ids back to inputs.
    const toInsert = [];
    const insertedIndexes: number[] = [];
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      const sig = signatures[i];

      const plaidTransactionId = typeof t.plaidTransactionId === "string" ? t.plaidTransactionId : null;
      if (plaidTransactionId) {
        if (existingPlaidIds.has(plaidTransactionId)) {
          skippedCount++;
          continue;
        }
        existingPlaidIds.add(plaidTransactionId);
      } else if (skipDuplicates && existingSignatures.has(sig)) {
        skippedCount++;
        continue;
      }

      const { categoryId, budgetItemId } = normalizeAssignment({
        categoryId: t.categoryId,
        budgetItemId: t.budgetItemId,
      });

      insertedIndexes.push(i);
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
        plaidTransactionId,
        originalDescription: t.originalDescription || null,
        merchantName: t.merchantName || null,
        transactedAt: t.transactedAt ? new Date(t.transactedAt) : null,
        details: t.details ?? null,
        categoryId,
        budgetItemId,
        projectId: ownedProjectIds.has(t.projectId) ? t.projectId : null,
        reviewStatus: t.reviewStatus === "pending" ? "pending" : "reviewed",
        conflictCategories: Array.isArray(t.conflictCategories) ? t.conflictCategories : null,
        importId: t.importId || null,
        userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Bulk insert in batches to stay under SQLite's variable limit
    // (~27 columns per row; 30 rows keeps it under the old 999 default)
    const BATCH_SIZE = 30;
    const insertedIds: number[] = [];
    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const rows = await db.insert(schema.transactions).values(batch).returning({ id: schema.transactions.id });
        insertedIds.push(...rows.map((r) => r.id));
      }
      insertedCount = toInsert.length;
    }

    return NextResponse.json({
      data: {
        inserted: insertedCount,
        skipped: skippedCount,
        total: transactions.length,
        // Parallel to the request: which input rows were inserted, and their new ids.
        ids: insertedIndexes.map((index, n) => ({ index, id: insertedIds[n] })),
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
