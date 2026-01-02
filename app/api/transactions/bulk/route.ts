import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { } from "drizzle-orm";
import { randomUUID } from "crypto";

// POST /api/transactions/bulk
export async function POST(request: NextRequest) {
  try {
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
    const signatures = transactions.map((t) => {
      const date = new Date(t.date).toISOString().split("T")[0];
      return `${date}|${t.description}|${t.amountOut}|${t.amountIn}`;
    });

    // Check for existing duplicates if skipDuplicates is true
    let existingSignatures = new Set<string>();
    if (skipDuplicates) {
      const existingTransactions = await db.select().from(schema.transactions);

      existingSignatures = new Set(
        existingTransactions.map((t) => {
          const date = t.date.toISOString().split("T")[0];
          return `${date}|${t.description}|${t.amountOut}|${t.amountIn}`;
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
        categoryId: t.categoryId || null,
        importId: t.importId || null,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Bulk insert
    if (toInsert.length > 0) {
      await db.insert(schema.transactions).values(toInsert);
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
    console.error("POST /api/transactions/bulk error:", error);
    return NextResponse.json(
      { error: "Failed to bulk insert transactions", success: false },
      { status: 500 }
    );
  }
}
