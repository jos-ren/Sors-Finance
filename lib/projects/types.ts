/**
 * Project read models returned by /api/projects. Dates are YYYY-MM-DD strings
 * (see lib/projects/dates.ts); amounts are net money out (refunds reduce them).
 */

import type { Keyword, ProjectStatus } from "@/lib/db/types";

export interface ProjectSummary {
  id: number;
  uuid: string;
  name: string;
  color: string;
  startDate: string;
  endDate: string | null;
  budget: number | null;
  fundedSeparately: boolean;
  keywords: Keyword[];
  fundCategoryId: number | null;
  fundCategoryName: string | null;
  /** Net transfers into the linked saving category, lifetime. */
  fundSetAside: number | null;
  notes: string | null;
  isArchived: boolean;
  status: ProjectStatus;
  spent: number;
  transactionCount: number;
}

export interface ProjectCategorySlice {
  /** "item:<id>", "system:<id>" or "uncategorized" */
  key: string;
  name: string;
  groupName: string | null;
  amount: number;
}

export interface ProjectMonthSlice {
  year: number;
  /** 0-based */
  month: number;
  amount: number;
}

export interface ProjectTransaction {
  id: number;
  date: string;
  description: string;
  amountOut: number;
  amountIn: number;
  budgetItemId: number | null;
  categoryId: number | null;
  categoryName: string;
  note: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  byCategory: ProjectCategorySlice[];
  byMonth: ProjectMonthSlice[];
  transactions: ProjectTransaction[];
  /** Unassigned everyday spending inside the date window. Never auto-assigned. */
  suggestions: ProjectTransaction[];
}

export interface ProjectInput {
  name: string;
  color?: string;
  startDate: string;
  endDate?: string | null;
  budget?: number | null;
  fundedSeparately?: boolean;
  keywords?: Keyword[];
  fundCategoryId?: number | null;
  notes?: string | null;
  isArchived?: boolean;
}
