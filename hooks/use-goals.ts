/**
 * Goals (sinking fund) hooks — SWR read models over /api/goals plus mutation
 * wrappers. A goal is a budget subcategory with itemType 'goal', so mutations
 * reuse the subcategory client fns and invalidate both the goals and budget
 * read models. Cache keys: goals/<y>/<m>   goal/<id>/<y>/<m>
 */

import useSWR, { mutate } from "swr";
import * as api from "@/lib/db/client";
import type { GoalSummary, GoalDetail } from "@/lib/budget/types";
import { invalidateBudgetHierarchy } from "./use-budget";

const swrConfig = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
};

export function invalidateGoals() {
  mutate((key: string) => typeof key === "string" && (key.startsWith("goals") || key.startsWith("goal/")));
}

// ---- Read hooks -------------------------------------------------------------

export function useGoals(year: number, month: number): GoalSummary[] | undefined {
  const { data } = useSWR(`goals/${year}/${month}`, () => api.getGoals(year, month), swrConfig);
  return data;
}

export function useGoal(id: number, year: number, month: number): GoalDetail | undefined {
  const { data } = useSWR(
    Number.isFinite(id) ? `goal/${id}/${year}/${month}` : null,
    () => api.getGoal(id, year, month),
    swrConfig
  );
  return data;
}

// ---- Mutations --------------------------------------------------------------

export interface GoalInput {
  name: string;
  groupId: number;
  targetAmount: number | null;
  /** Epoch ms deadline, or null. */
  targetDate: number | null;
}

export async function createGoal(input: GoalInput) {
  const r = await api.createSubcategory(input.name, input.groupId, {
    itemType: "goal",
    targetAmount: input.targetAmount,
    targetDate: input.targetDate,
  });
  invalidateGoals();
  invalidateBudgetHierarchy();
  return r;
}

export async function updateGoal(id: number, updates: Partial<GoalInput> & { isActive?: boolean }) {
  const r = await api.updateSubcategory(id, updates);
  invalidateGoals();
  invalidateBudgetHierarchy();
  return r;
}

export async function deleteGoal(id: number) {
  const r = await api.deleteSubcategory(id);
  invalidateGoals();
  invalidateBudgetHierarchy();
  return r;
}
