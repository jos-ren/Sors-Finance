import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

const CHUNK = 100;

const key = (year: number, month: number) => year * 12 + month;

// POST /api/budgets/apply-to-previous — copy one month's budget into earlier months.
// Body: { fromYear, fromMonth, months? }. Months are 0-based.
//   - without `months`: lists the earlier months that could be filled (they have
//     transactions or already have a budget), each flagged `hasBudget`.
//   - with `months`: [{ year, month }] copies the source's planned amounts (active
//     categories only) and planned income into each, replacing whatever budget that
//     month had. Only months before the source are accepted. All-or-nothing.
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const { fromYear, fromMonth, months } = await request.json();

    if (!Number.isInteger(fromYear) || !Number.isInteger(fromMonth) || fromMonth < 0 || fromMonth > 11) {
      return NextResponse.json({ error: "fromYear and fromMonth are required", success: false }, { status: 400 });
    }
    const fromKey = key(fromYear, fromMonth);

    const sourceBudgets = (
      await db
        .select({
          budgetItemId: schema.budgets.budgetItemId,
          amount: schema.budgets.amount,
          isActive: schema.budgetSubcategories.isActive,
        })
        .from(schema.budgets)
        .innerJoin(schema.budgetSubcategories, eq(schema.budgets.budgetItemId, schema.budgetSubcategories.id))
        .where(
          and(
            eq(schema.budgets.year, fromYear),
            eq(schema.budgets.month, fromMonth),
            eq(schema.budgets.userId, userId)
          )
        )
    ).filter((b) => b.isActive);

    if (sourceBudgets.length === 0) {
      return NextResponse.json({ error: "The selected month has no budget to copy", success: false }, { status: 400 });
    }

    // Listing: earlier months with transactions or an existing budget.
    if (!Array.isArray(months)) {
      const txDates = await db
        .select({ date: schema.transactions.date })
        .from(schema.transactions)
        .where(eq(schema.transactions.userId, userId));
      const budgetedRows = await db
        .select({ year: schema.budgets.year, month: schema.budgets.month })
        .from(schema.budgets)
        .where(eq(schema.budgets.userId, userId));

      const candidates = new Set<number>();
      for (const t of txDates) {
        const k = key(t.date.getFullYear(), t.date.getMonth());
        if (k < fromKey) candidates.add(k);
      }
      const budgeted = new Set<number>();
      for (const r of budgetedRows) {
        const k = key(r.year, r.month);
        if (k < fromKey) {
          budgeted.add(k);
          candidates.add(k);
        }
      }
      const list = [...candidates]
        .sort((a, b) => a - b)
        .map((k) => ({ year: Math.floor(k / 12), month: k % 12, hasBudget: budgeted.has(k) }));
      return NextResponse.json({ data: { months: list, copied: 0 }, success: true });
    }

    // Apply: validate and de-duplicate the requested months.
    const targets: { year: number; month: number }[] = [];
    const seen = new Set<number>();
    for (const m of months) {
      if (!Number.isInteger(m?.year) || !Number.isInteger(m?.month) || m.month < 0 || m.month > 11) continue;
      const k = key(m.year, m.month);
      if (k >= fromKey || seen.has(k)) continue;
      seen.add(k);
      targets.push({ year: m.year, month: m.month });
    }
    if (targets.length === 0) {
      return NextResponse.json({ data: { months: [], copied: 0 }, success: true });
    }

    const [sourceIncome] = await db
      .select({ amount: schema.plannedIncome.amount })
      .from(schema.plannedIncome)
      .where(
        and(
          eq(schema.plannedIncome.year, fromYear),
          eq(schema.plannedIncome.month, fromMonth),
          eq(schema.plannedIncome.userId, userId)
        )
      )
      .limit(1);

    const now = new Date();
    // One synchronous transaction (better-sqlite3): a failure leaves every month as it was.
    db.transaction((tx) => {
      for (const { year, month } of targets) {
        tx.delete(schema.budgets)
          .where(and(eq(schema.budgets.userId, userId), eq(schema.budgets.year, year), eq(schema.budgets.month, month)))
          .run();
        const rows = sourceBudgets.map((b) => ({
          budgetItemId: b.budgetItemId,
          year,
          month,
          amount: b.amount,
          userId,
          createdAt: now,
          updatedAt: now,
        }));
        for (let i = 0; i < rows.length; i += CHUNK) {
          tx.insert(schema.budgets).values(rows.slice(i, i + CHUNK)).run();
        }

        if (sourceIncome) {
          tx.delete(schema.plannedIncome)
            .where(
              and(
                eq(schema.plannedIncome.userId, userId),
                eq(schema.plannedIncome.year, year),
                eq(schema.plannedIncome.month, month)
              )
            )
            .run();
          tx.insert(schema.plannedIncome)
            .values({ year, month, amount: sourceIncome.amount, userId, createdAt: now, updatedAt: now })
            .run();
        }
      }
    });

    return NextResponse.json({
      data: { months: targets, copied: targets.length * sourceBudgets.length },
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("POST /api/budgets/apply-to-previous error:", error);
    return NextResponse.json({ error: "Failed to apply budget to earlier months", success: false }, { status: 500 });
  }
}
