/**
 * Shared budget tree / summary shapes consumed by the budget page and the
 * yearly totals view. Kept dependency-free so both client and server import it.
 */

import type { BudgetItemType, Keyword } from "@/lib/db/types";

export interface BudgetTreeCategory {
  id: number;
  uuid: string;
  name: string;
  order: number;
  itemType: BudgetItemType;
  targetAmount: number | null;
  isActive: boolean;
  keywords: Keyword[];
  /** id of the `budgets` row for this category+period, if one exists. */
  budgetId: number | null;
  planned: number;
  /** Net spending in the period (amountOut − amountIn). */
  actual: number;
  /** Lifetime net for goal categories (sum across all periods); 0 for expenses. */
  cumulative: number;
  /** Lifetime allocations (SUM of budgets.amount) for goals; 0 for expenses. */
  contributed: number;
  /** Lifetime net transactions for goals (money drawn from the fund); 0 for expenses. */
  spent: number;
  /** contributed − spent for goals; 0 for expenses. */
  available: number;
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

// ---- Goals (sinking funds) --------------------------------------------------
// A goal accumulates monthly allocations (budgets rows) into a fund; spending
// linked transactions draws the fund down. Progress vs targetAmount is measured
// by `contributed`, never by spend.

export interface GoalSummary {
  id: number;
  uuid: string;
  name: string;
  groupId: number;
  groupName: string;
  isActive: boolean;
  targetAmount: number | null;
  /** Goal deadline as epoch ms, if set. */
  targetDate: number | null;
  /** SUM(budgets.amount) across all months. */
  contributed: number;
  /** Lifetime net transactions (amountOut − amountIn). */
  spent: number;
  /** contributed − spent. */
  available: number;
  /** The current period's allocation. */
  thisMonthContributed: number;
  isComplete: boolean;
  /** Whole months from the requested period until targetDate (null without a date). */
  monthsRemaining: number | null;
  /** max(0, (target − contributed) / monthsRemaining); null without date/target or when past due. */
  requiredPerMonth: number | null;
}

export interface GoalContributionPoint {
  year: number;
  month: number; // 0-based, matching the budgets table convention
  amount: number;
}

export interface GoalDetail extends GoalSummary {
  /** Per-month allocation history, ordered by year/month ascending. */
  contributions: GoalContributionPoint[];
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
