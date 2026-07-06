/**
 * Shared budget tree / summary shapes consumed by the budget page and the
 * yearly totals view. Kept dependency-free so both client and server import it.
 */

import type { BudgetItemType } from "@/lib/db/types";

export interface BudgetTreeCategory {
  id: number;
  uuid: string;
  name: string;
  order: number;
  itemType: BudgetItemType;
  targetAmount: number | null;
  isActive: boolean;
  keywords: string[];
  /** id of the `budgets` row for this category+period, if one exists. */
  budgetId: number | null;
  planned: number;
  /** Net spending in the period (amountOut − amountIn). */
  actual: number;
  /** Lifetime net for goal categories (sum across all periods); 0 for expenses. */
  cumulative: number;
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

export interface YearlySummary {
  year: number;
  groups: YearlySummaryGroup[];
  incomeByMonth: number[]; // length 12
  plannedByMonth: number[];
  actualByMonth: number[];
}
