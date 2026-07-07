/**
 * Client-side API wrapper for the goals (sinking fund) read models.
 * year/month identify the current period (0-based month) for
 * thisMonthContributed and pace.
 */

import type { GoalSummary, GoalDetail } from "@/lib/budget/types";

export async function getGoals(year: number, month: number): Promise<GoalSummary[]> {
  const res = await fetch(`/api/goals?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("Failed to fetch goals");
  const { data } = await res.json();
  return data as GoalSummary[];
}

export async function getGoal(id: number, year: number, month: number): Promise<GoalDetail> {
  const res = await fetch(`/api/goals/${id}?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("Failed to fetch goal");
  const { data } = await res.json();
  return data as GoalDetail;
}
