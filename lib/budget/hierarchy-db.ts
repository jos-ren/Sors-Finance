/**
 * Shared server-side helpers for the budget hierarchy CRUD routes:
 * descendant counts (so DELETE can report what a cascade will affect) and a
 * generic within-scope reorder.
 */

import { db, schema } from "@/lib/db/connection";
import { and, eq, inArray, sql, asc } from "drizzle-orm";

export interface GroupDeleteImpact {
  subcategories: number;
  transactions: number;
}

export interface SubcategoryDeleteImpact {
  transactions: number;
  budgets: number;
}

async function subcategoryIdsUnderGroup(userId: number, groupId: number): Promise<number[]> {
  const rows = await db
    .select({ id: schema.budgetSubcategories.id })
    .from(schema.budgetSubcategories)
    .where(and(eq(schema.budgetSubcategories.groupId, groupId), eq(schema.budgetSubcategories.userId, userId)));
  return rows.map((r) => r.id);
}

async function countTransactionsForSubcategories(userId: number, subcategoryIds: number[]): Promise<number> {
  if (subcategoryIds.length === 0) return 0;
  const res = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(schema.transactions)
    .where(and(inArray(schema.transactions.budgetItemId, subcategoryIds), eq(schema.transactions.userId, userId)));
  return res[0]?.c ?? 0;
}

export async function groupDeleteImpact(userId: number, groupId: number): Promise<GroupDeleteImpact> {
  const subcategoryIds = await subcategoryIdsUnderGroup(userId, groupId);
  const transactions = await countTransactionsForSubcategories(userId, subcategoryIds);
  return { subcategories: subcategoryIds.length, transactions };
}

export async function subcategoryDeleteImpact(userId: number, subId: number): Promise<SubcategoryDeleteImpact> {
  const transactions = await countTransactionsForSubcategories(userId, [subId]);
  const budgets = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(schema.budgets)
    .where(and(eq(schema.budgets.budgetItemId, subId), eq(schema.budgets.userId, userId)));
  return { transactions, budgets: budgets[0]?.c ?? 0 };
}

type ReorderTable = typeof schema.budgetGroups | typeof schema.budgetSubcategories;

/**
 * Reorder rows within a user scope by moving `activeId` to `overId`'s position.
 * Optionally constrain to a parent (e.g. reorder subcategories within one group).
 */
export async function reorderWithinScope(
  table: ReorderTable,
  userId: number,
  activeId: number,
  overId: number,
  parent?: { column: "groupId"; id: number }
): Promise<boolean> {
  const scope = [eq(table.userId, userId)];
  if (parent) {
    // @ts-expect-error dynamic column access constrained by caller
    scope.push(eq(table[parent.column], parent.id));
  }

  const rows = await db.select().from(table).where(and(...scope)).orderBy(asc(table.order));
  const activeIndex = rows.findIndex((r) => r.id === activeId);
  const overIndex = rows.findIndex((r) => r.id === overId);
  if (activeIndex === -1 || overIndex === -1) return false;

  const [moved] = rows.splice(activeIndex, 1);
  rows.splice(overIndex, 0, moved);

  const now = new Date();
  for (let i = 0; i < rows.length; i++) {
    await db
      .update(table)
      .set({ order: i, updatedAt: now })
      .where(and(eq(table.id, rows[i].id), eq(table.userId, userId)));
  }
  return true;
}
