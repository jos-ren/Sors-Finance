/**
 * Client-side API wrapper for the budget hierarchy (groups → subcategories →
 * items): CRUD, reorder, archive/restore, keyword add/remove.
 */

import type { DbBudgetGroup, DbBudgetSubcategory, DbBudgetItem, BudgetItemType } from "../types";

export interface BudgetHierarchy {
  groups: DbBudgetGroup[];
  subcategories: DbBudgetSubcategory[];
  items: DbBudgetItem[];
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

// ---- Read -------------------------------------------------------------------

export async function getBudgetHierarchy(includeArchived = false): Promise<BudgetHierarchy> {
  const res = await fetch(`/api/budget/hierarchy${includeArchived ? "?includeArchived=true" : ""}`);
  if (!res.ok) throw new Error("Failed to fetch budget hierarchy");
  const { data } = await res.json();
  return {
    groups: (data.groups as DbBudgetGroup[]).map(withDates),
    subcategories: (data.subcategories as DbBudgetSubcategory[]).map(withDates),
    items: (data.items as DbBudgetItem[]).map(withDates),
  };
}

// ---- Groups -----------------------------------------------------------------

export const createGroup = (name: string) =>
  postJson<DbBudgetGroup>("/api/budget/groups", { name });

export const updateGroup = (id: number, updates: { name?: string; order?: number }) =>
  putJson<{ updated: boolean }>(`/api/budget/groups/${id}`, updates);

export const deleteGroup = (id: number) =>
  del<{ deleted: boolean; subcategories: number; items: number; transactions: number }>(`/api/budget/groups/${id}`);

export const reorderGroups = (activeId: number, overId: number) =>
  postJson("/api/budget/groups/reorder", { activeId, overId });

// ---- Subcategories ----------------------------------------------------------

export const createSubcategory = (name: string, groupId: number) =>
  postJson<DbBudgetSubcategory>("/api/budget/subcategories", { name, groupId });

export const updateSubcategory = (id: number, updates: { name?: string; order?: number; groupId?: number }) =>
  putJson<{ updated: boolean }>(`/api/budget/subcategories/${id}`, updates);

export const deleteSubcategory = (id: number) =>
  del<{ deleted: boolean; items: number; transactions: number }>(`/api/budget/subcategories/${id}`);

export const reorderSubcategories = (activeId: number, overId: number, groupId?: number) =>
  postJson("/api/budget/subcategories/reorder", { activeId, overId, groupId });

// ---- Items ------------------------------------------------------------------

export interface CreateItemInput {
  name: string;
  subcategoryId: number;
  keywords?: string[];
  itemType?: BudgetItemType;
  targetAmount?: number | null;
}

export const createItem = (input: CreateItemInput) =>
  postJson<DbBudgetItem>("/api/budget/items", input);

export interface UpdateItemInput {
  name?: string;
  order?: number;
  keywords?: string[];
  itemType?: BudgetItemType;
  targetAmount?: number | null;
  isActive?: boolean;
  subcategoryId?: number;
}

export const updateItem = (id: number, updates: UpdateItemInput) =>
  putJson<{ assigned: number }>(`/api/budget/items/${id}`, updates);

export const deleteItem = (id: number) =>
  del<{ deleted: boolean; transactions: number; budgets: number }>(`/api/budget/items/${id}`);

export const reorderItems = (activeId: number, overId: number, subcategoryId?: number) =>
  postJson("/api/budget/items/reorder", { activeId, overId, subcategoryId });

export const archiveItem = (id: number) => updateItem(id, { isActive: false });
export const restoreItem = (id: number) => updateItem(id, { isActive: true });

export async function addKeywordToItem(id: number, keyword: string, currentKeywords: string[]): Promise<void> {
  if (currentKeywords.some((k) => k.toLowerCase() === keyword.toLowerCase())) return;
  await updateItem(id, { keywords: [...currentKeywords, keyword] });
}

export async function removeKeywordFromItem(id: number, keyword: string, currentKeywords: string[]): Promise<void> {
  await updateItem(id, { keywords: currentKeywords.filter((k) => k.toLowerCase() !== keyword.toLowerCase()) });
}
