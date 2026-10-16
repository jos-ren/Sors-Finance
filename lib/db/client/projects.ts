/**
 * Client-side API wrapper for projects: time-bound labels on transactions
 * (Japan trip, Moving out, New car). Dates are YYYY-MM-DD strings.
 */

import type { ProjectDetail, ProjectInput, ProjectSummary } from "@/lib/projects/types";

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function getProjects(): Promise<ProjectSummary[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error(await errorMessage(res, "Failed to fetch projects"));
  const { data } = await res.json();
  return data as ProjectSummary[];
}

export async function getProject(id: number): Promise<ProjectDetail> {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) throw new Error(await errorMessage(res, "Failed to fetch project"));
  const { data } = await res.json();
  return data as ProjectDetail;
}

export async function createProject(input: ProjectInput): Promise<number> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Failed to create project"));
  const { data } = await res.json();
  return data.id as number;
}

export async function updateProject(id: number, updates: Partial<ProjectInput>): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Failed to update project"));
}

export async function deleteProject(id: number): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await errorMessage(res, "Failed to delete project"));
}

/** Add transactions to a project, or remove them with projectId = null. */
export async function setTransactionsProject(ids: number[], projectId: number | null): Promise<number> {
  const res = await fetch("/api/transactions/project", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, projectId }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Failed to update project assignment"));
  const { data } = await res.json();
  return data.updated as number;
}
