/**
 * Client-side API wrapper for import operations
 */

import type { DbImport } from "../types";

export async function getImports(): Promise<DbImport[]> {
  const res = await fetch("/api/imports");
  if (!res.ok) throw new Error("Failed to fetch imports");
  const { data } = await res.json();
  return data.map((i: DbImport) => ({
    ...i,
    importedAt: new Date(i.importedAt),
  }));
}

export async function addImport(importData: {
  fileName: string;
  source: string;
  transactionCount: number;
  totalAmount: number;
}): Promise<number> {
  const res = await fetch("/api/imports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(importData),
  });
  if (!res.ok) throw new Error("Failed to create import");
  const { data } = await res.json();
  return data.id;
}

export async function updateImport(
  id: number,
  updates: { transactionCount?: number; totalAmount?: number }
): Promise<void> {
  const res = await fetch(`/api/imports/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update import");
}

export async function deleteImport(id: number): Promise<void> {
  const res = await fetch(`/api/imports/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete import");
}
