/**
 * Projects hooks: SWR read models over /api/projects plus mutation wrappers.
 * Cache keys: projects   project/<id>
 *
 * Assigning a project changes monthly numbers when the project is funded
 * separately, so assignment and project edits also invalidate transactions,
 * Home and the budget views.
 */

import useSWR, { mutate } from "swr";
import * as api from "@/lib/db/client";
import type { ProjectDetail, ProjectInput, ProjectSummary } from "@/lib/projects/types";
import { invalidateTransactions } from "./use-database";

const swrConfig = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
};

export function invalidateProjects() {
  mutate((key: string) => typeof key === "string" && (key === "projects" || key.startsWith("project/")));
}

// ---- Read hooks -------------------------------------------------------------

export function useProjects(): ProjectSummary[] | undefined {
  const { data } = useSWR("projects", () => api.getProjects(), swrConfig);
  return data;
}

export function useProject(id: number): { project: ProjectDetail | undefined; error: Error | undefined } {
  const { data, error } = useSWR(
    Number.isFinite(id) ? `project/${id}` : null,
    () => api.getProject(id),
    swrConfig
  );
  return { project: data, error };
}

// ---- Mutations --------------------------------------------------------------

export async function createProject(input: ProjectInput) {
  const id = await api.createProject(input);
  invalidateProjects();
  return id;
}

export async function updateProject(id: number, updates: Partial<ProjectInput>) {
  await api.updateProject(id, updates);
  // Funding, dates or archive state change what the monthly views count
  invalidateTransactions();
}

export async function deleteProject(id: number) {
  await api.deleteProject(id);
  invalidateTransactions();
}

export async function setTransactionsProject(ids: number[], projectId: number | null) {
  const updated = await api.setTransactionsProject(ids, projectId);
  invalidateTransactions();
  return updated;
}
