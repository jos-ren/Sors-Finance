import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

const CHUNK = 100;

// POST /api/budgets/apply-to-previous — copy one month's budget into every earlier
// month that has transactions but no budget rows at all.
// Body: { fromYear, fromMonth, dryRun? }. Months are 0-based. Skips archived
// categories, never touches months that already have a budget, and copies the
// planned income too when the target month has none. dryRun only reports the months.
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const { fromYear, fromMonth, dryRun } = await request.json();

    if (!Number.isInteger(fromYear) || !Number.isInteger(fromMonth) || fromMonth < 0 || fromMonth > 11) {
      return NextResponse.json({ error: "fromYear and fromMonth are required", success: false }, { status: 400 });
    }
    const fromKey = fromYear * 12 + fromMonth;

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

    // Months before the source that have transactions.
    const txDates = await db
      .select({ date: schema.transactions.date })
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, userId));
    const txMonths = new Set<number>();
    for (const t of txDates) {
      const key = t.date.getFullYear() * 12 + t.date.getMonth();
      if (key < fromKey) txMonths.add(key);
    }

    // Months that already have a budget are left alone.
    const budgetedRows = await db
      .select({ year: schema.budgets.year, month: schema.budgets.month })
      .from(schema.budgets)
      .where(eq(schema.budgets.userId, userId));
    const budgeted = new Set(budgetedRows.map((r) => r.year * 12 + r.month));

    const targets = [...txMonths]
      .filter((key) => !budgeted.has(key))
      .sort((a, b) => a - b)
      .map((key) => ({ year: Math.floor(key / 12), month: key % 12 }));

    if (dryRun || targets.length === 0) {
      return NextResponse.json({ data: { months: targets, copied: 0 }, success: true });
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
    const budgetRows = targets.flatMap(({ year, month }) =>
      sourceBudgets.map((b) => ({
        budgetItemId: b.budgetItemId,
        year,
        month,
        amount: b.amount,
        userId,
        createdAt: now,
        updatedAt: now,
      }))
    );
    const incomeRows = sourceIncome
      ? targets.map(({ year, month }) => ({
          year,
          month,
          amount: sourceIncome.amount,
          userId,
          createdAt: now,
          updatedAt: now,
        }))
      : [];

    let copied = 0;
    for (let i = 0; i < budgetRows.length; i += CHUNK) {
      const res = await db
        .insert(schema.budgets)
        .values(budgetRows.slice(i, i + CHUNK))
        .onConflictDoNothing({
          target: [schema.budgets.budgetItemId, schema.budgets.year, schema.budgets.month, schema.budgets.userId],
        })
        .returning({ id: schema.budgets.id });
      copied += res.length;
    }
    for (let i = 0; i < incomeRows.length; i += CHUNK) {
      await db
        .insert(schema.plannedIncome)
        .values(incomeRows.slice(i, i + CHUNK))
        .onConflictDoNothing({
          target: [schema.plannedIncome.year, schema.plannedIncome.month, schema.plannedIncome.userId],
        });
    }

    return NextResponse.json({ data: { months: targets, copied }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("POST /api/budgets/apply-to-previous error:", error);
    return NextResponse.json({ error: "Failed to apply budget to earlier months", success: false }, { status: 500 });
  }
}
