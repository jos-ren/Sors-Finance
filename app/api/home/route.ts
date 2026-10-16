import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { SYSTEM_CATEGORIES } from "@/lib/db/types";
import { classifyCategory, isSeparateProject, type MoneyClass } from "@/lib/budget/classify";
import type { HomeSummary, HomeDueBill, HomeHistoryMonth, HomeProjectSpend, PaceStatus } from "@/lib/budget/home-types";

// GET /api/home?year=2026&month=9 (0-based month)
//
// One pass over the selected month plus the 12 months before it. Every
// category is classed via classifyCategory(): bills are tracked as paid,
// saving transactions are transfers, and only spending is paced.
// Uncategorized money out counts as spending so "left to spend" stays
// conservative; Excluded rows are ignored entirely. Transactions in a
// separately funded project leave the monthly math and are reported per
// project instead (they still count against Saved).

const HISTORY_MONTHS = 12;
const DUE_SOON_DAYS = 7;
const WATCH_TOLERANCE = 1.1;
// Only flag overspends worth acting on: $25+, or $10+ that is also 10%+ of the budget.
const isMeaningfulOverspend = (over: number, budget: number) => over >= 25 || (over >= 10 && over / budget >= 0.1);

const monthKey = (y: number, m: number) => y * 12 + m;

function paceStatus(budget: number, spent: number, expected: number): PaceStatus {
  if (budget <= 0) return "no-budget";
  if (spent > budget) return "over-budget";
  if (spent <= expected) return "on-track";
  if (spent <= expected * WATCH_TOLERANCE) return "watch";
  return "over-pace";
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const params = request.nextUrl.searchParams;
    const now = new Date();
    const year = parseInt(params.get("year") ?? `${now.getFullYear()}`, 10);
    const month = parseInt(params.get("month") ?? `${now.getMonth()}`, 10);
    if (Number.isNaN(year) || Number.isNaN(month) || month < 0 || month > 11) {
      return NextResponse.json({ error: "Invalid year/month", success: false }, { status: 400 });
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const selectedKey = monthKey(year, month);
    const nowKey = monthKey(now.getFullYear(), now.getMonth());
    const isCurrentMonth = selectedKey === nowKey;
    const elapsedDays = selectedKey < nowKey ? daysInMonth : isCurrentMonth ? now.getDate() : 0;

    const rangeStart = new Date(year, month - HISTORY_MONTHS, 1);
    const rangeEnd = new Date(year, month + 1, 0, 23, 59, 59);

    const [sysCats, categories, budgetRows, txs, counts, planned, projectRows] = await Promise.all([
      db
        .select({ id: schema.categories.id, name: schema.categories.name })
        .from(schema.categories)
        .where(and(eq(schema.categories.isSystem, true), eq(schema.categories.userId, userId))),
      db
        .select({
          id: schema.budgetSubcategories.id,
          name: schema.budgetSubcategories.name,
          itemType: schema.budgetSubcategories.itemType,
          isRecurring: schema.budgetSubcategories.isRecurring,
        })
        .from(schema.budgetSubcategories)
        .where(eq(schema.budgetSubcategories.userId, userId)),
      db
        .select({
          budgetItemId: schema.budgets.budgetItemId,
          year: schema.budgets.year,
          month: schema.budgets.month,
          amount: schema.budgets.amount,
        })
        .from(schema.budgets)
        .where(
          and(
            eq(schema.budgets.userId, userId),
            gte(sql`${schema.budgets.year} * 12 + ${schema.budgets.month}`, selectedKey - HISTORY_MONTHS),
            lte(sql`${schema.budgets.year} * 12 + ${schema.budgets.month}`, selectedKey)
          )
        ),
      db
        .select({
          date: schema.transactions.date,
          amountIn: schema.transactions.amountIn,
          amountOut: schema.transactions.amountOut,
          categoryId: schema.transactions.categoryId,
          budgetItemId: schema.transactions.budgetItemId,
          projectId: schema.transactions.projectId,
        })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, userId),
            gte(schema.transactions.date, rangeStart),
            lte(schema.transactions.date, rangeEnd)
          )
        ),
      db
        .select({
          uncategorized: sql<number>`SUM(CASE WHEN ${schema.transactions.budgetItemId} IS NULL AND (${schema.transactions.categoryId} IS NULL OR ${schema.transactions.categoryId} = (SELECT id FROM categories WHERE user_id = ${userId} AND is_system = 1 AND name = ${SYSTEM_CATEGORIES.UNCATEGORIZED})) THEN 1 ELSE 0 END)`,
          pendingReview: sql<number>`SUM(CASE WHEN ${schema.transactions.reviewStatus} = 'pending' THEN 1 ELSE 0 END)`,
        })
        .from(schema.transactions)
        .where(eq(schema.transactions.userId, userId)),
      db
        .select({ amount: schema.plannedIncome.amount })
        .from(schema.plannedIncome)
        .where(
          and(
            eq(schema.plannedIncome.userId, userId),
            eq(schema.plannedIncome.year, year),
            eq(schema.plannedIncome.month, month)
          )
        )
        .limit(1),
      db
        .select({
          id: schema.projects.id,
          name: schema.projects.name,
          color: schema.projects.color,
          fundedSeparately: schema.projects.fundedSeparately,
        })
        .from(schema.projects)
        .where(eq(schema.projects.userId, userId)),
    ]);

    const excludedId = sysCats.find((c) => c.name === SYSTEM_CATEGORIES.EXCLUDED)?.id;
    const incomeId = sysCats.find((c) => c.name === SYSTEM_CATEGORIES.INCOME)?.id;
    const classOf = new Map<number, MoneyClass>(categories.map((c) => [c.id, classifyCategory(c)]));
    const nameOf = new Map(categories.map((c) => [c.id, c.name]));
    const projectOf = new Map(projectRows.map((p) => [p.id, p]));

    // ---- Budgets: per month per class, and per category for the selected month
    const budgetByMonthClass = new Map<string, number>();
    const budgetByCategory = new Map<number, number>();
    for (const b of budgetRows) {
      const cls = classOf.get(b.budgetItemId);
      if (!cls) continue;
      const k = `${monthKey(b.year, b.month)}:${cls}`;
      budgetByMonthClass.set(k, (budgetByMonthClass.get(k) ?? 0) + b.amount);
      if (monthKey(b.year, b.month) === selectedKey) budgetByCategory.set(b.budgetItemId, b.amount);
    }
    const budgetFor = (key: number, cls: MoneyClass) => budgetByMonthClass.get(`${key}:${cls}`) ?? 0;

    // ---- Transactions
    const spentByMonth = new Map<number, number>();
    const spentByCategory = new Map<number, number>(); // selected month, by category
    const dailySpending = new Array<number>(daysInMonth).fill(0);
    const prevMonthBillDay = new Map<number, { day: number; amount: number }>();
    let billsPaid = 0;
    const incomeByMonth = new Map<number, number>();
    // month key → project id → net spend, for separately funded projects
    const projectSpendByMonth = new Map<number, Map<number, number>>();

    for (const t of txs) {
      if (excludedId !== undefined && t.categoryId === excludedId) continue;
      const d = t.date;
      const key = monthKey(d.getFullYear(), d.getMonth());
      const net = t.amountOut - t.amountIn;

      const project = t.projectId != null ? projectOf.get(t.projectId) : undefined;
      if (project && isSeparateProject(project)) {
        const byProject = projectSpendByMonth.get(key) ?? new Map<number, number>();
        byProject.set(project.id, (byProject.get(project.id) ?? 0) + net);
        projectSpendByMonth.set(key, byProject);
        continue;
      }

      if (t.budgetItemId == null) {
        if (incomeId !== undefined && t.categoryId === incomeId) {
          incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + t.amountIn - t.amountOut);
          continue;
        }
        // Uncategorized: money out counts as spending (conservative).
        if (t.amountOut > 0) {
          spentByMonth.set(key, (spentByMonth.get(key) ?? 0) + t.amountOut);
          if (key === selectedKey) dailySpending[d.getDate() - 1] += t.amountOut;
        }
        continue;
      }

      const cls = classOf.get(t.budgetItemId) ?? "spending";
      if (cls === "spending") {
        spentByMonth.set(key, (spentByMonth.get(key) ?? 0) + net);
        if (key === selectedKey) {
          dailySpending[d.getDate() - 1] += net;
          spentByCategory.set(t.budgetItemId, (spentByCategory.get(t.budgetItemId) ?? 0) + net);
        }
      } else if (cls === "bill") {
        if (key === selectedKey) {
          billsPaid += net;
          spentByCategory.set(t.budgetItemId, (spentByCategory.get(t.budgetItemId) ?? 0) + net);
        } else if (key === selectedKey - 1 && net > 0) {
          const prev = prevMonthBillDay.get(t.budgetItemId);
          if (!prev || d.getDate() > prev.day) prevMonthBillDay.set(t.budgetItemId, { day: d.getDate(), amount: net });
        }
      }
      // "saving": transfers to savings, not spending.
    }

    // ---- Spending pace
    const spendingBudget = budgetFor(selectedKey, "spending");
    const cumulativeByDay: number[] = [];
    let running = 0;
    for (let i = 0; i < daysInMonth; i++) {
      running += dailySpending[i];
      cumulativeByDay.push(Math.round(running * 100) / 100);
    }
    const spent = running;
    const expectedByToday = spendingBudget * (elapsedDays / daysInMonth);

    // ---- Bills due soon (only meaningful for the current month)
    const dueSoon: HomeDueBill[] = [];
    if (isCurrentMonth) {
      for (const [categoryId, last] of prevMonthBillDay) {
        if ((spentByCategory.get(categoryId) ?? 0) > 0) continue; // already paid this month
        const expectedDay = Math.min(last.day, daysInMonth);
        const daysUntil = expectedDay - elapsedDays;
        if (daysUntil > DUE_SOON_DAYS) continue;
        dueSoon.push({ categoryId, name: nameOf.get(categoryId) ?? "Bill", expectedDay, amount: last.amount, overdue: daysUntil < 0 });
      }
      dueSoon.sort((a, b) => a.expectedDay - b.expectedDay);
    }

    // ---- Separately funded projects, per month
    const projectSpendFor = (key: number): HomeProjectSpend[] =>
      [...(projectSpendByMonth.get(key) ?? new Map<number, number>()).entries()]
        .map(([id, amount]) => {
          const p = projectOf.get(id)!;
          return { id, name: p.name, color: p.color, amount: Math.round(amount * 100) / 100 };
        })
        .filter((p) => p.amount !== 0)
        .sort((a, b) => b.amount - a.amount);
    const monthProjects = projectSpendFor(selectedKey);
    const toProjects = monthProjects.reduce((sum, p) => sum + p.amount, 0);

    // ---- Saving
    const income = incomeByMonth.get(selectedKey) ?? 0;
    const toSavings = budgetFor(selectedKey, "saving");
    const saved = income - billsPaid - spent - toProjects;

    // Mid-month, "saved so far" is skewed (bills land early, pay arrives
    // biweekly), so project the month end: expected income minus bills and
    // spending continued at today's pace.
    let projected: HomeSummary["saving"]["projected"] = null;
    if (isCurrentMonth && elapsedDays > 0) {
      const plannedAmount = planned[0]?.amount;
      const expectedIncome = plannedAmount ?? incomeByMonth.get(selectedKey - 1) ?? 0;
      const projectedSpending = (spent / elapsedDays) * daysInMonth;
      const projectedBills = Math.max(budgetFor(selectedKey, "bill"), billsPaid);
      projected = {
        income: expectedIncome,
        incomeSource: plannedAmount != null ? "planned" : "last-month",
        saved: expectedIncome - projectedBills - projectedSpending - toProjects,
      };
    }

    // ---- History: previous complete months, oldest first
    const history: HomeHistoryMonth[] = [];
    for (let k = selectedKey - HISTORY_MONTHS; k < selectedKey; k++) {
      history.push({
        year: Math.floor(k / 12),
        month: k % 12,
        budget: budgetFor(k, "spending"),
        spent: Math.round((spentByMonth.get(k) ?? 0) * 100) / 100,
        projects: projectSpendFor(k),
      });
    }

    // ---- Overspent spending categories this month
    const overspent = [...budgetByCategory.entries()]
      .filter(([id, budget]) => classOf.get(id) === "spending" && budget > 0)
      .map(([id, budget]) => ({ categoryId: id, name: nameOf.get(id) ?? "", over: (spentByCategory.get(id) ?? 0) - budget, budget }))
      .filter((o) => isMeaningfulOverspend(o.over, o.budget))
      .map(({ categoryId, name, over }) => ({ categoryId, name, over }))
      .sort((a, b) => b.over - a.over)
      .slice(0, 3);

    const data: HomeSummary = {
      year,
      month,
      daysInMonth,
      elapsedDays,
      isCurrentMonth,
      spending: {
        budget: spendingBudget,
        spent,
        cumulativeByDay,
        expectedByToday,
        status: paceStatus(spendingBudget, spent, expectedByToday),
      },
      bills: { budget: budgetFor(selectedKey, "bill"), paid: billsPaid, dueSoon },
      saving: { income, toSavings, toProjects, saved, rate: income > 0 ? saved / income : 0, projected },
      projects: monthProjects,
      history,
      attention: {
        uncategorized: counts[0]?.uncategorized ?? 0,
        pendingReview: counts[0]?.pendingReview ?? 0,
        overspent,
      },
    };

    return NextResponse.json({ data, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/home error:", error);
    return NextResponse.json({ error: "Failed to load home summary", success: false }, { status: 500 });
  }
}
