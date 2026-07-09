/**
 * Client-side API wrapper for the budget hierarchy (Category Groups →
 * Categories): CRUD, reorder, archive/restore, keyword add/remove.
 */

import type { DbBudgetGroup, DbBudgetSubcategory, BudgetItemType, Keyword, KeywordMatchMode } from "../types";

export interface BudgetHierarchy {
  groups: DbBudgetGroup[];
  subcategories: DbBudgetSubcategory[];
}

const withDates = <T extends { createdAt: unknown; updatedAt: unknown }>(row: T) => ({
  ...row,
  createdAt: new Date(row.createdAt as string),
  updatedAt: new Date(row.updatedAt as string),
});

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed: ${url}`);
  const { data } = await res.json();
  return data;
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed: ${url}`);
  const { data } = await res.json();
  return data;
}

async function del<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`Request failed: ${url}`);
  const { data } = await res.json();
  return data;
}

// ---- Seed -------------------------------------------------------------------

export async function seedDefaultBudget(): Promise<void> {
  const res = await fetch("/api/budget/seed-default", { method: "POST" });
  if (!res.ok) throw new Error("Failed to seed starter budget");
}

// ---- Read -------------------------------------------------------------------

export async function getBudgetHierarchy(includeArchived = false): Promise<BudgetHierarchy> {
  const res = await fetch(`/api/budget/hierarchy${includeArchived ? "?includeArchived=true" : ""}`);
  if (!res.ok) throw new Error("Failed to fetch budget hierarchy");
  const { data } = await res.json();
  return {
    groups: (data.groups as DbBudgetGroup[]).map(withDates),
    subcategories: (data.subcategories as DbBudgetSubcategory[]).map(withDates),
  };
}

// ---- Groups -----------------------------------------------------------------

export const createGroup = (name: string) =>
  postJson<DbBudgetGroup>("/api/budget/groups", { name });

export const updateGroup = (id: number, updates: { name?: string; order?: number }) =>
  putJson<{ updated: boolean }>(`/api/budget/groups/${id}`, updates);

export const deleteGroup = (id: number) =>
  del<{ deleted: boolean; subcategories: number; transactions: number }>(`/api/budget/groups/${id}`);

export const reorderGroups = (activeId: number, overId: number) =>
  postJson("/api/budget/groups/reorder", { activeId, overId });

// ---- Categories (subcategory rows) -------------------------------------------

export interface CreateCategoryInput {
  name: string;
  groupId: number;
  keywords?: Keyword[];
  itemType?: BudgetItemType;
  targetAmount?: number | null;
  /** Goal deadline as epoch ms. */
  targetDate?: number | null;
}

export const createSubcategory = (name: string, groupId: number, extra?: Omit<CreateCategoryInput, "name" | "groupId">) =>
  postJson<DbBudgetSubcategory>("/api/budget/subcategories", { name, groupId, ...extra });

export interface UpdateCategoryInput {
  name?: string;
  order?: number;
  groupId?: number;
  keywords?: Keyword[];
  itemType?: BudgetItemType;
  targetAmount?: number | null;
  /** Goal deadline as epoch ms. */
  targetDate?: number | null;
  isActive?: boolean;
}

export const updateSubcategory = (id: number, updates: UpdateCategoryInput) =>
  putJson<{ assigned: number }>(`/api/budget/subcategories/${id}`, updates);

export const deleteSubcategory = (id: number) =>
  del<{ deleted: boolean; transactions: number; budgets: number }>(`/api/budget/subcategories/${id}`);

export const reorderSubcategories = (activeId: number, overId: number, groupId?: number) =>
  postJson("/api/budget/subcategories/reorder", { activeId, overId, groupId });

export const archiveSubcategory = (id: number) => updateSubcategory(id, { isActive: false });
export const restoreSubcategory = (id: number) => updateSubcategory(id, { isActive: true });

export async function addKeywordToSubcategory(
  id: number,
  keyword: string,
  currentKeywords: Keyword[],
  mode: KeywordMatchMode = "contains"
): Promise<void> {
  if (currentKeywords.some((k) => k.text.toLowerCase() === keyword.toLowerCase())) return;
  await updateSubcategory(id, { keywords: [...currentKeywords, { text: keyword, mode }] });
}

export async function removeKeywordFromSubcategory(id: number, keyword: string, currentKeywords: Keyword[]): Promise<void> {
  await updateSubcategory(id, { keywords: currentKeywords.filter((k) => k.text.toLowerCase() !== keyword.toLowerCase()) });
}
