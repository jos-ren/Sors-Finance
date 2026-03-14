/**
 * Client-side API wrapper for import draft operations
 */

import type { DbImportDraft, ImportDraftData } from "../types";

export async function getImportDrafts(): Promise<DbImportDraft[]> {
  const res = await fetch("/api/import-drafts");
  if (!res.ok) throw new Error("Failed to fetch import drafts");
  const { data } = await res.json();
  return data.map((d: DbImportDraft) => ({
    ...d,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  }));
}

export async function saveImportDraft(draft: {
  uuid?: string;
  name: string;
  importSource: string;
  currentStep: string;
  transactionCount: number;
  draftData: ImportDraftData;
}): Promise<{ id: number; uuid: string }> {
  const res = await fetch("/api/import-drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  if (!res.ok) throw new Error("Failed to save import draft");
  const { data } = await res.json();
  return data;
}

export async function deleteImportDraft(id: number): Promise<void> {
  const res = await fetch(`/api/import-drafts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete import draft");
}
