/**
 * Budget hierarchy + tree hooks (SWR).
 *
 * Split out of use-database.ts (which was approaching 1000 lines) to hold the
 * zero-based budgeting read models and mutation wrappers. Cache keys:
 *   budget-hierarchy/<incl>   budget-tree/<y>/<m>   budget-yearly/<y>
 *   goal-progress             income/<y>/<m>
 */

import useSWR, { mutate } from "swr";
import * as api from "@/lib/db/client";
import type { DbBudgetSubcategory } from "@/lib/db/types";
import type { BudgetTree, YearlySummary } from "@/lib/budget/types";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/lib/db/client/budget-hierarchy";

const swrConfig = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
};

// ---- Invalidation -----------------------------------------------------------

/** Structural changes to the hierarchy also change every derived read model. */
export function invalidateBudgetHierarchy() {
  mutate(
    (key: string) =>
      typeof key === "string" &&
      (key.startsWith("budget-hierarchy") ||
        key.startsWith("budget-tree") ||
        key.startsWith("budget-yearly") ||
        key.startsWith("goal-progress"))
  );
}

/** Amount changes affect the tree + yearly rollups (and legacy budgets keys). */
export function invalidateBudgetTree() {
  mutate(
    (key: string) =>
      typeof key === "string" &&
      (key.startsWith("budgets") || key.startsWith("budget-tree") || key.startsWith("budget-yearly"))
  );
}

// ---- Read hooks -------------------------------------------------------------

export function useBudgetHierarchy(includeArchived = false) {
  const { data } = useSWR(
    `budget-hierarchy/${includeArchived}`,
    () => api.getBudgetHierarchy(includeArchived),
    swrConfig
  );
  return data;
}

export function useBudgetTree(year: number, month: number): BudgetTree | undefined {
  const { data } = useSWR(`budget-tree/${year}/${month}`, () => api.getBudgetTree(year, month), swrConfig);
  return data;
}

export function useYearlyBudgetSummary(year: number): YearlySummary | undefined {
  const { data } = useSWR(`budget-yearly/${year}`, () => api.getYearlySummary(year), swrConfig);
  return data;
}

export function useArchivedBudgetCategories(): DbBudgetSubcategory[] | undefined {
  const hierarchy = useBudgetHierarchy(true);
  return hierarchy?.subcategories.filter((c) => !c.isActive);
}

export function useGoalProgress(): Map<number, number> | undefined {
  const { data } = useSWR("goal-progress", () => api.getGoalProgress(), swrConfig);
  return data;
}

export function useIncomeTotal(year: number, month: number): number | undefined {
  const { data } = useSWR(`income/${year}/${month}`, () => api.getIncomeTotal(year, month), swrConfig);
  return data;
}

export function usePlannedIncome(year: number, month: number): number | null | undefined {
  const { data } = useSWR(`planned-income/${year}/${month}`, () => api.getPlannedIncome(year, month), swrConfig);
  return data;
}

// ---- Mutation wrappers ------------------------------------------------------
// Structure mutations save immediately and refresh the whole hierarchy.

export async function createGroup(name: string) {
  const r = await api.createGroup(name);
  invalidateBudgetHierarchy();
  return r;
}
export async function updateGroup(id: number, updates: { name?: string; order?: number }) {
  const r = await api.updateGroup(id, updates);
  invalidateBudgetHierarchy();
  return r;
}
export async function deleteGroup(id: number) {
  const r = await api.deleteGroup(id);
  invalidateBudgetHierarchy();
  return r;
}
export async function reorderGroups(activeId: number, overId: number) {
  const r = await api.reorderGroups(activeId, overId);
  invalidateBudgetHierarchy();
  return r;
}

export async function createSubcategory(name: string, groupId: number, extra?: Omit<CreateCategoryInput, "name" | "groupId">) {
  const r = await api.createSubcategory(name, groupId, extra);
  invalidateBudgetHierarchy();
  return r;
}
export async function updateSubcategory(id: number, updates: UpdateCategoryInput) {
  const r = await api.updateSubcategory(id, updates);
  invalidateBudgetHierarchy();
  return r;
}
export async function deleteSubcategory(id: number) {
  const r = await api.deleteSubcategory(id);
  invalidateBudgetHierarchy();
  return r;
}
export async function reorderSubcategories(activeId: number, overId: number, groupId?: number) {
  const r = await api.reorderSubcategories(activeId, overId, groupId);
  invalidateBudgetHierarchy();
  return r;
}
export async function archiveSubcategory(id: number) {
  const r = await api.archiveSubcategory(id);
  invalidateBudgetHierarchy();
  return r;
}
export async function restoreSubcategory(id: number) {
  const r = await api.restoreSubcategory(id);
  invalidateBudgetHierarchy();
  return r;
}
export async function addKeywordToSubcategory(id: number, keyword: string, currentKeywords: string[]) {
  const r = await api.addKeywordToSubcategory(id, keyword, currentKeywords);
  invalidateBudgetHierarchy();
  return r;
}
export async function removeKeywordFromSubcategory(id: number, keyword: string, currentKeywords: string[]) {
  const r = await api.removeKeywordFromSubcategory(id, keyword, currentKeywords);
  invalidateBudgetHierarchy();
  return r;
}

// Amount mutations refresh the tree + yearly rollups.

export async function setBudgetAmount(budgetItemId: number, year: number, month: number, amount: number) {
  const id = await api.setBudget(budgetItemId, year, month, amount);
  invalidateBudgetTree();
  return id;
}
export async function setPlannedIncomeAmount(year: number, month: number, amount: number) {
  const id = await api.setPlannedIncome(year, month, amount);
  mutate(`planned-income/${year}/${month}`);
  return id;
}
export async function copyBudgetToMonth(fromYear: number, fromMonth: number, toYear: number, toMonth: number) {
  const copied = await api.copyBudgetToMonth(fromYear, fromMonth, toYear, toMonth);
  invalidateBudgetTree();
  return copied;
}
