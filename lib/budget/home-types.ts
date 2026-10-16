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

/** Spending on one separately funded project within a month. */
export interface HomeProjectSpend {
  id: number;
  name: string;
  color: string;
  amount: number;
}

export interface HomeHistoryMonth {
  year: number;
  month: number; // 0–11
  budget: number;
  /** Everyday spending only; separately funded projects are in `projects`. */
  spent: number;
  projects: HomeProjectSpend[];
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
    /** This month's planned amounts on saving categories. */
    toSavings: number;
    /** Separately funded project spending this month (see `projects`). */
    toProjects: number;
    /** income − bills.paid − spending.spent − toProjects */
    saved: number;
    /** saved / income, 0 when there is no income. */
    rate: number;
    /** Current month only: where saving lands by month end at today's pace. */
    projected: {
      /** Planned income for the month, else last month's actual income. */
      income: number;
      incomeSource: "planned" | "last-month";
      /** income − max(bills budget, paid) − spending projected at current pace − project spending so far */
      saved: number;
    } | null;
  };
  /** Separately funded projects with spending in the selected month, largest first. */
  projects: HomeProjectSpend[];
  /** Previous 12 complete months, oldest first. */
  history: HomeHistoryMonth[];
  attention: {
    uncategorized: number;
    pendingReview: number;
    overspent: HomeOverspent[];
  };
}
