/**
 * Project read models (server only). A project's spending is the net money
 * out of its transactions, ignoring Excluded rows. Category and month
 * breakdowns describe what the money went on and when.
 */

import { db, schema } from "@/lib/db/connection";
import { and, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { SYSTEM_CATEGORIES, type Keyword } from "@/lib/db/types";
import { classifyCategory } from "@/lib/budget/classify";
import type { ProjectRow } from "@/lib/db/schema";
import { parseDayString, projectStatus, toDayString, windowEnd } from "./dates";
import type {
  ProjectCategorySlice,
  ProjectDetail,
  ProjectInput,
  ProjectMonthSlice,
  ProjectSummary,
  ProjectTransaction,
} from "./types";

const SUGGESTION_LIMIT = 200;
const round2 = (n: number) => Math.round(n * 100) / 100;

async function systemCategoryIds(userId: number) {
  const rows = await db
    .select({ id: schema.categories.id, name: schema.categories.name })
    .from(schema.categories)
    .where(and(eq(schema.categories.userId, userId), eq(schema.categories.isSystem, true)));
  return {
    excludedId: rows.find((r) => r.name === SYSTEM_CATEGORIES.EXCLUDED)?.id ?? -1,
    incomeId: rows.find((r) => r.name === SYSTEM_CATEGORIES.INCOME)?.id ?? -1,
    names: new Map(rows.map((r) => [r.id, r.name])),
  };
}

/** Lifetime net transfers into each saving category used as a fund. */
async function fundTotals(userId: number, fundIds: number[]) {
  if (fundIds.length === 0) return new Map<number, number>();
  const rows = await db
    .select({
      budgetItemId: schema.transactions.budgetItemId,
      net: sql<number>`SUM(${schema.transactions.amountOut} - ${schema.transactions.amountIn})`,
    })
    .from(schema.transactions)
    .where(and(eq(schema.transactions.userId, userId), inArray(schema.transactions.budgetItemId, fundIds)))
    .groupBy(schema.transactions.budgetItemId);
  return new Map(rows.map((r) => [r.budgetItemId as number, round2(r.net ?? 0)]));
}

function toSummary(
  p: ProjectRow,
  totals: { spent: number; count: number } | undefined,
  fundName: string | null,
  fundSetAside: number | null,
  now: Date
): ProjectSummary {
  return {
    id: p.id,
    uuid: p.uuid,
    name: p.name,
    color: p.color,
    startDate: toDayString(p.startDate),
    endDate: p.endDate ? toDayString(p.endDate) : null,
    budget: p.budget,
    fundedSeparately: p.fundedSeparately,
    keywords: p.keywords ?? [],
    fundCategoryId: p.fundCategoryId,
    fundCategoryName: fundName,
    fundSetAside,
    notes: p.notes,
    isArchived: p.isArchived,
    status: projectStatus(p.startDate, p.endDate, now),
    spent: round2(totals?.spent ?? 0),
    transactionCount: totals?.count ?? 0,
  };
}

export async function getProjectSummaries(userId: number): Promise<ProjectSummary[]> {
  const now = new Date();
  const [{ excludedId }, projectRows, totals, subcats] = await Promise.all([
    systemCategoryIds(userId),
    db.select().from(schema.projects).where(eq(schema.projects.userId, userId)),
    db
      .select({
        projectId: schema.transactions.projectId,
        categoryId: schema.transactions.categoryId,
        net: sql<number>`SUM(${schema.transactions.amountOut} - ${schema.transactions.amountIn})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), sql`${schema.transactions.projectId} IS NOT NULL`))
      .groupBy(schema.transactions.projectId, schema.transactions.categoryId),
    db
      .select({ id: schema.budgetSubcategories.id, name: schema.budgetSubcategories.name })
      .from(schema.budgetSubcategories)
      .where(eq(schema.budgetSubcategories.userId, userId)),
  ]);

  const byProject = new Map<number, { spent: number; count: number }>();
  for (const t of totals) {
    if (t.categoryId === excludedId) continue;
    const cur = byProject.get(t.projectId as number) ?? { spent: 0, count: 0 };
    cur.spent += t.net ?? 0;
    cur.count += t.count ?? 0;
    byProject.set(t.projectId as number, cur);
  }

  const subName = new Map(subcats.map((s) => [s.id, s.name]));
  const fundIds = [...new Set(projectRows.map((p) => p.fundCategoryId).filter((id): id is number => id != null))];
  const funds = await fundTotals(userId, fundIds);

  return projectRows
    .map((p) =>
      toSummary(
        p,
        byProject.get(p.id),
        p.fundCategoryId != null ? subName.get(p.fundCategoryId) ?? null : null,
        p.fundCategoryId != null ? funds.get(p.fundCategoryId) ?? 0 : null,
        now
      )
    )
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function getProjectDetail(userId: number, projectId: number): Promise<ProjectDetail | null> {
  const now = new Date();
  const project = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
    .get();
  if (!project) return null;

  const [sys, subcats, groups, rows] = await Promise.all([
    systemCategoryIds(userId),
    db
      .select({
        id: schema.budgetSubcategories.id,
        name: schema.budgetSubcategories.name,
        groupId: schema.budgetSubcategories.groupId,
        itemType: schema.budgetSubcategories.itemType,
        isRecurring: schema.budgetSubcategories.isRecurring,
      })
      .from(schema.budgetSubcategories)
      .where(eq(schema.budgetSubcategories.userId, userId)),
    db
      .select({ id: schema.budgetGroups.id, name: schema.budgetGroups.name })
      .from(schema.budgetGroups)
      .where(eq(schema.budgetGroups.userId, userId)),
    db
      .select()
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), eq(schema.transactions.projectId, projectId)))
      .orderBy(schema.transactions.date),
  ]);

  const subById = new Map(subcats.map((s) => [s.id, s]));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));

  const describe = (t: typeof schema.transactions.$inferSelect): ProjectTransaction => {
    const sub = t.budgetItemId != null ? subById.get(t.budgetItemId) : undefined;
    const categoryName =
      sub?.name ?? (t.categoryId != null ? sys.names.get(t.categoryId) : undefined) ?? SYSTEM_CATEGORIES.UNCATEGORIZED;
    return {
      id: t.id,
      date: t.date.toISOString(),
      description: t.description,
      amountOut: t.amountOut,
      amountIn: t.amountIn,
      budgetItemId: t.budgetItemId,
      categoryId: t.categoryId,
      categoryName,
      note: t.note,
    };
  };

  const counted = rows.filter((t) => t.categoryId !== sys.excludedId);
  const byCategory = new Map<string, ProjectCategorySlice>();
  const byMonth = new Map<number, ProjectMonthSlice>();
  let spent = 0;
  for (const t of counted) {
    const net = t.amountOut - t.amountIn;
    spent += net;

    const sub = t.budgetItemId != null ? subById.get(t.budgetItemId) : undefined;
    const key = sub ? `item:${sub.id}` : t.categoryId != null ? `system:${t.categoryId}` : "uncategorized";
    const slice = byCategory.get(key) ?? {
      key,
      name: describe(t).categoryName,
      groupName: sub ? groupName.get(sub.groupId) ?? null : null,
      amount: 0,
    };
    slice.amount += net;
    byCategory.set(key, slice);

    const y = t.date.getUTCFullYear();
    const m = t.date.getUTCMonth();
    const mk = y * 12 + m;
    const month = byMonth.get(mk) ?? { year: y, month: m, amount: 0 };
    month.amount += net;
    byMonth.set(mk, month);
  }

  // Suggestions: unassigned everyday spending inside the window. Bills,
  // saving transfers, income and Excluded rows are never suggested.
  const candidates = await db
    .select()
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.userId, userId),
        isNull(schema.transactions.projectId),
        gte(schema.transactions.date, project.startDate),
        lt(schema.transactions.date, windowEnd(project.endDate, now)),
        sql`${schema.transactions.amountOut} > 0`,
        or(
          isNull(schema.transactions.categoryId),
          and(
            sql`${schema.transactions.categoryId} <> ${sys.excludedId}`,
            sql`${schema.transactions.categoryId} <> ${sys.incomeId}`
          )
        )
      )
    )
    .orderBy(schema.transactions.date)
    .limit(SUGGESTION_LIMIT);
  const suggestions = candidates
    .filter((t) => {
      if (t.budgetItemId == null) return true;
      const sub = subById.get(t.budgetItemId);
      return !sub || classifyCategory(sub) === "spending";
    })
    .map(describe);

  let fundName: string | null = null;
  let fundSetAside: number | null = null;
  if (project.fundCategoryId != null) {
    fundName = subById.get(project.fundCategoryId)?.name ?? null;
    fundSetAside = (await fundTotals(userId, [project.fundCategoryId])).get(project.fundCategoryId) ?? 0;
  }

  return {
    ...toSummary(project, { spent, count: counted.length }, fundName, fundSetAside, now),
    byCategory: [...byCategory.values()]
      .map((s) => ({ ...s, amount: round2(s.amount) }))
      .sort((a, b) => b.amount - a.amount),
    byMonth: [...byMonth.values()]
      .map((m) => ({ ...m, amount: round2(m.amount) }))
      .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month)),
    transactions: rows.map(describe).reverse(),
    suggestions,
  };
}

// ---- Input validation -------------------------------------------------------

type ProjectValues = Partial<
  Pick<
    ProjectRow,
    | "name"
    | "color"
    | "startDate"
    | "endDate"
    | "budget"
    | "fundedSeparately"
    | "keywords"
    | "fundCategoryId"
    | "notes"
    | "isArchived"
  >
>;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Validate a create (partial = false) or update (partial = true) body.
 * Returns the column values to write, or an error message.
 */
export async function parseProjectInput(
  userId: number,
  body: Partial<ProjectInput>,
  partial: boolean
): Promise<{ values: ProjectValues } | { error: string }> {
  const values: ProjectValues = {};

  if (body.name !== undefined || !partial) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { error: "Name is required" };
    values.name = name;
  }
  if (body.color !== undefined) {
    if (typeof body.color !== "string" || !HEX_COLOR.test(body.color)) return { error: "Invalid colour" };
    values.color = body.color;
  }
  if (body.startDate !== undefined || !partial) {
    const start = parseDayString(body.startDate);
    if (!start) return { error: "Start date is required (YYYY-MM-DD)" };
    values.startDate = start;
  }
  if (body.endDate !== undefined) {
    if (body.endDate === null || body.endDate === "") values.endDate = null;
    else {
      const end = parseDayString(body.endDate);
      if (!end) return { error: "Invalid end date" };
      values.endDate = end;
    }
  }
  if (body.budget !== undefined) {
    if (body.budget === null) values.budget = null;
    else if (typeof body.budget !== "number" || !Number.isFinite(body.budget) || body.budget < 0) {
      return { error: "Budget must be a positive number" };
    } else values.budget = body.budget;
  }
  if (body.fundedSeparately !== undefined) values.fundedSeparately = !!body.fundedSeparately;
  if (body.isArchived !== undefined) values.isArchived = !!body.isArchived;
  if (body.notes !== undefined) values.notes = body.notes ? String(body.notes) : null;
  if (body.keywords !== undefined) {
    if (!Array.isArray(body.keywords)) return { error: "Invalid keywords" };
    values.keywords = body.keywords
      .filter((k): k is Keyword => !!k && typeof k.text === "string" && k.text.trim() !== "")
      .map((k) => ({ text: k.text.trim(), mode: k.mode === "startsWith" || k.mode === "exact" ? k.mode : "contains" }));
  }
  if (body.fundCategoryId !== undefined) {
    if (body.fundCategoryId === null) values.fundCategoryId = null;
    else {
      const fund = await db
        .select({ id: schema.budgetSubcategories.id, itemType: schema.budgetSubcategories.itemType, isRecurring: schema.budgetSubcategories.isRecurring })
        .from(schema.budgetSubcategories)
        .where(and(eq(schema.budgetSubcategories.id, Number(body.fundCategoryId)), eq(schema.budgetSubcategories.userId, userId)))
        .get();
      if (!fund || classifyCategory(fund) !== "saving") return { error: "Fund must be a saving category" };
      values.fundCategoryId = fund.id;
    }
  }

  return { values };
}

/** True when the date window is valid once the update is applied. */
export function isValidWindow(startDate: Date, endDate: Date | null | undefined): boolean {
  return !endDate || endDate.getTime() >= startDate.getTime();
}

export async function projectBelongsToUser(userId: number, projectId: number): Promise<boolean> {
  const row = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
    .get();
  return !!row;
}
