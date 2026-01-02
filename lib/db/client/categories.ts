/**
 * Client-side API wrapper for category operations
 */

import type { DbCategory, UpdateCategoryResult } from "../types";

export async function getCategories(): Promise<DbCategory[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Failed to fetch categories");
  const { data } = await res.json();
  return data.map((c: DbCategory) => ({
    ...c,
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
  }));
}

export async function getCategoryById(id: number): Promise<DbCategory | null> {
  const res = await fetch(`/api/categories/${id}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch category");
  }
  const { data } = await res.json();
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

export async function addCategory(name: string, keywords: string[] = []): Promise<number> {
  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, keywords }),
  });
  if (!res.ok) throw new Error("Failed to create category");
  const { data } = await res.json();
  return data.id;
}

export async function updateCategory(
  id: number,
  updates: Partial<Omit<DbCategory, "id" | "uuid" | "createdAt">>
): Promise<UpdateCategoryResult> {
  const res = await fetch(`/api/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update category");
  const { data } = await res.json();
  return data;
}

export async function deleteCategory(id: number): Promise<void> {
  const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete category");
}

export async function reorderCategories(activeId: number, overId: number): Promise<void> {
  const res = await fetch("/api/categories/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activeId, overId }),
  });
  if (!res.ok) throw new Error("Failed to reorder categories");
}

export async function addKeywordToCategory(categoryId: number, keyword: string): Promise<void> {
  const category = await getCategoryById(categoryId);
  if (!category) throw new Error("Category not found");

  const keywords = [...category.keywords];
  if (!keywords.some((k) => k.toLowerCase() === keyword.toLowerCase())) {
    keywords.push(keyword);
    await updateCategory(categoryId, { keywords });
  }
}

export async function removeKeywordFromCategory(categoryId: number, keyword: string): Promise<void> {
  const category = await getCategoryById(categoryId);
  if (!category) throw new Error("Category not found");

  const keywords = category.keywords.filter((k) => k.toLowerCase() !== keyword.toLowerCase());
  await updateCategory(categoryId, { keywords });
}

export async function getExcludedCategory(): Promise<DbCategory | undefined> {
  const categories = await getCategories();
  return categories.find((c) => c.name === "Excluded");
}

export async function getUncategorizedCategory(): Promise<DbCategory | undefined> {
  const categories = await getCategories();
  return categories.find((c) => c.name === "Uncategorized");
}
