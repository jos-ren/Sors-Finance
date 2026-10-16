/**
 * Shared budget tree / summary shapes consumed by the budget page and the
 * yearly totals view. Kept dependency-free so both client and server import it.
 */

import type { BudgetItemType, Keyword } from "@/lib/db/types";

/** Spending on a separately funded project, left out of a category's `actual`. */
export interface BudgetTreeProjectSpend {
  projectId: number;
  name: string;
  color: string;
  amount: number;
}

export interface BudgetTreeCategory {
  id: number;
  uuid: string;
  name: string;
  order: number;
  itemType: BudgetItemType;
  targetAmount: number | null;
  /** Fixed monthly bill; see lib/budget/classify.ts. */
  isRecurring: boolean;
  isActive: boolean;
  keywords: Keyword[];
  /** id of the `budgets` row for this category+period, if one exists. */
  budgetId: number | null;
  planned: number;
  /** Net spending in the period (amountOut − amountIn). */
  actual: number;
  /** Saving target date as epoch ms, if set. */
  targetDate: number | null;
  /** Saving categories: lifetime net money set aside (all periods); 0 for expenses. */
  contributed: number;
  /** Separately funded project spending in the period (not in `actual`). */
  projectSpend: BudgetTreeProjectSpend[];
}

export interface BudgetTreeGroup {
  id: number;
  uuid: string;
  name: string;
  order: number;
  planned: number;
  actual: number;
  categories: BudgetTreeCategory[];
}

export interface BudgetTreeSummary {
  incomeActual: number;
  totalBudgeted: number;
  totalActual: number;
  availableToAssign: number;
}

export interface BudgetTree {
  year: number;
  month: number;
  groups: BudgetTreeGroup[];
  summary: BudgetTreeSummary;
}

// ---- Yearly totals view -----------------------------------------------------

export interface YearlySummaryCategory {
  id: number;
  uuid: string;
  name: string;
  itemType: BudgetItemType;
  isActive: boolean;
  plannedByMonth: number[]; // length 12
  actualByMonth: number[]; // length 12
  plannedTotal: number;
  actualTotal: number;
}

export interface YearlySummaryGroup {
  id: number;
  uuid: string;
  name: string;
  categories: YearlySummaryCategory[];
}

export interface YearlySummaryProject {
  id: number;
  name: string;
  color: string;
  total: number;
}

export interface YearlySummary {
  year: number;
  groups: YearlySummaryGroup[];
  incomeByMonth: number[]; // length 12
  plannedByMonth: number[];
  /** Budget categories only; separately funded projects are in projectsByMonth. */
  actualByMonth: number[];
  projectsByMonth: number[];
  /** Separately funded projects with spending this year, largest first. */
  projects: YearlySummaryProject[];
}
