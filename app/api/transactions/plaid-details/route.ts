import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { and, eq, isNull } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import type { TransactionDetails } from "@/lib/db/types";

interface PlaidDetailsUpdate {
  id: number;
  /** Corrected local-midnight date (ISO). */
  date: string;
  plaidTransactionId: string;
  matchField: string;
  originalDescription: string | null;
  merchantName: string | null;
  transactedAt: string | null;
  details: TransactionDetails | null;
}

/**
 * POST /api/transactions/plaid-details
 *
 * Backfills bank-feed details onto Plaid rows imported before those were
 * stored, and fixes their date (older imports landed a day early west of UTC).
 * Category, review state and description are left alone. Rows that already
 * carry a Plaid id are skipped.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const { updates } = (await request.json()) as { updates?: PlaidDetailsUpdate[] };

    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: "updates array is required", success: false }, { status: 400 });
    }

    const now = new Date();
    let updated = 0;

    db.transaction((tx) => {
      for (const u of updates) {
        const date = new Date(u.date);
        if (!Number.isInteger(u.id) || !u.plaidTransactionId || Number.isNaN(date.getTime())) continue;
        const transactedAt = u.transactedAt ? new Date(u.transactedAt) : null;
        const result = tx
          .update(schema.transactions)
          .set({
            date,
            plaidTransactionId: u.plaidTransactionId,
            matchField: u.matchField,
            originalDescription: u.originalDescription,
            merchantName: u.merchantName,
            transactedAt: transactedAt && !Number.isNaN(transactedAt.getTime()) ? transactedAt : null,
            details: u.details,
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.transactions.id, u.id),
              eq(schema.transactions.userId, userId),
              isNull(schema.transactions.plaidTransactionId)
            )
          )
          .run();
        updated += result.changes;
      }
    });

    return NextResponse.json({ data: { updated }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("POST /api/transactions/plaid-details error:", error);
    return NextResponse.json({ error: "Failed to update transactions", success: false }, { status: 500 });
  }
}
