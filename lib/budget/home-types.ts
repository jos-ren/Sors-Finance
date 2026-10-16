/**
 * Shape returned by GET /api/home: the month summary behind the Home page.
 * Kept dependency-free so both client and server import it.
 */

export type PaceStatus = "on-track" | "watch" | "over-pace" | "over-budget" | "no-budget";

export interface HomeDueBill {
  categoryId: number;
  name: string;
  /** Expected day of month, inferred from last month's transaction. */
  expectedDay: number;
  /** Last month's amount, as an estimate. */
  amount: number;
  overdue: boolean;
}

export interface HomeOverspent {
  categoryId: number;
  name: string;
  over: number;
}

export interface HomeHistoryMonth {
  year: number;
  month: number; // 0–11
  budget: number;
  spent: number;
}

export interface HomeSummary {
  year: number;
  month: number; // 0–11
  daysInMonth: number;
  /** Day of month "today" falls on for this period: daysInMonth for past months, 0 for future ones. */
  elapsedDays: number;
  isCurrentMonth: boolean;
  spending: {
    budget: number;
    spent: number;
    /** Running spending total per day, length daysInMonth (flat after today). */
    cumulativeByDay: number[];
    /** Spending budget × elapsedDays / daysInMonth. */
    expectedByToday: number;
    status: PaceStatus;
  };
  bills: {
    budget: number;
    paid: number;
    dueSoon: HomeDueBill[];
  };
  saving: {
    income: number;
    /** This month's planned amounts on goal categories (what goals count as contributed). */
    toGoals: number;
    /** income − bills.paid − spending.spent */
    saved: number;
    /** saved / income, 0 when there is no income. */
    rate: number;
    /** Current month only: where saving lands by month end at today's pace. */
    projected: {
      /** Planned income for the month, else last month's actual income. */
      income: number;
      incomeSource: "planned" | "last-month";
      /** income − max(bills budget, paid) − spending projected at current pace */
      saved: number;
    } | null;
  };
  /** Previous 12 complete months, oldest first. */
  history: HomeHistoryMonth[];
  attention: {
    uncategorized: number;
    pendingReview: number;
    overspent: HomeOverspent[];
  };
}
