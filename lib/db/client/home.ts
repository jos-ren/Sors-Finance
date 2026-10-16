/**
 * Home summary client wrapper (GET /api/home).
 */

import type { HomeSummary } from "@/lib/budget/home-types";

/** month is 0-based. */
export async function getHomeSummary(year: number, month: number): Promise<HomeSummary> {
  const res = await fetch(`/api/home?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("Failed to fetch home summary");
  const { data } = await res.json();
  return data;
}
