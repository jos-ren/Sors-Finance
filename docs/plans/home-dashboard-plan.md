# Home Dashboard Plan

Replace the Dashboard and the Portfolio overview with one Home page that answers two questions at a glance: **am I on track this month** and **is my net worth growing**. Portfolio becomes the place you manage accounts.

Background, critique and mock-up: "Sors Finance: Dashboard and Portfolio Critique" (Claude Doc).

## Status

- Phase 1: done.
- Phase 2: done. Additions beyond the original plan: month-end saving projection on the Saved tile (`saving.projected` in `/api/home`), round axis ticks (`lib/utils/chart-ticks.ts`). Net worth chart keeps every daily snapshot on all ranges (user preference).
- Phase 3: done, except net worth attribution (deferred to the goals refactor). Portfolio is labelled "Accounts" in the sidebar, page title and breadcrumbs; the `/portfolio` route is unchanged.

## Decisions

- **Three-way split of the monthly budget.**
  - **Bills:** categories with `isRecurring = true`. Shown as "paid of total" plus due-soon chips. No pace line.
  - **Saving:** goal categories (`itemType = "goal"`). Transactions here are treated as transfers, not spending.
  - **Spending:** everything else. Gets "left to spend", the pace line and the On track status.
- **Saved = income − bills − spending.** This is the true savings rate. Goal contributions are a subset of it ("$1,200 to goals, $700 kept in cash").
- **Recurring is a category flag,** not a per-transaction flag. Due dates are inferred from last month's transaction day.
- **No page-wide time picker.** Budget card uses a month stepper, the history strip is a fixed rolling 12 months, net worth uses range chips (1M, 3M, YTD, 1Y, All).
- **Goals will be refactored later.** All "is this saving?" logic goes through one helper so the refactor swaps one function. Do not build goal-to-account linking in this plan.

## Phase 1: Fix wrong numbers (no design changes)

1. **NULL-safe Excluded filter** in `app/api/transactions/aggregations/route.ts`.
   - `excludeFilter()` uses `ne(categoryId, excludedId)`. Budget-categorized rows have `categoryId = NULL`, and `NULL != x` is unknown in SQL, so every expense row is dropped. This is why Total Expenses shows $0.
   - Change to `or(isNull(schema.transactions.categoryId), ne(schema.transactions.categoryId, excludedId))`.
   - Affects `totals`, `allTimeTotals`, `monthlyTrend`, `dailyTrend`, `allTimeMonthlyTrend`. Check every call site.
2. **Clipped Y axis labels.**
   - `app/(main)/portfolio/page.tsx:314`: the `YAxis` has no `width`, so "140,000.00" renders as "40,000.00". Add a compact formatter (`$140k`, no cents) and a fixed width.
   - Same fix for the charts in `app/(main)/page.tsx`.
3. **Allocation donut owns assets only.** Remove Debt from the bucket and account datasets around `app/(main)/portfolio/page.tsx:205-216`. Show debt as a separate line under the legend.
4. **Monthly Expenses stacks by category group** (10 series) instead of by category (40+). Map `budgetItemId` to `groupId` using `useBudgetHierarchy`.

Exit check: import `sors-test-data.json`, confirm Total Expenses is non-zero and roughly matches the Category Distribution total.

## Phase 2: Home page

### 2a. Data model

1. Add `isRecurring: integer("is_recurring", { mode: "boolean" }).notNull().default(false)` to `budgetSubcategories` in `lib/db/schema.ts`. Run `npm run db:generate` for migration `0022`.
2. Add `isRecurring` to the `Category` type in `lib/db/types.ts` and the budget client wrappers in `lib/db/client/`.
3. Add a "Recurring bill" toggle to `components/features/budget/category-detail-dialog.tsx`, next to the existing Savings goal toggle. Hide it when the category is a goal.
4. Carry `isRecurring` through backup export/import in `app/api/data/route.ts` (default `false` when missing).
5. Mark sensible defaults as recurring in `lib/db/budget-hierarchy-data.ts` (Rent, Hydro, Internet, Phone, insurance, subscriptions).
6. Update the test data generator to set `isRecurring` on the bill categories and regenerate `sors-test-data.json`.
7. Add `lib/budget/classify.ts` with one function, `classifyCategory(cat): "bill" | "saving" | "spending"`. Every query and component uses this. The goal refactor later only touches this file.

### 2b. API

Add an aggregation type `homeSummary` (params: `year`, `month`) to `app/api/transactions/aggregations/route.ts`, or a new `app/api/home/route.ts` if it grows. It returns:

| Field | Definition |
| --- | --- |
| `spending.budget` | Sum of budget rows for spending categories this month |
| `spending.spent` | Money out minus money in for spending categories, plus uncategorized money out |
| `spending.cumulativeByDay` | Running total per day, for the pace line |
| `bills.budget`, `bills.paid` | Same, for recurring categories |
| `bills.dueSoon` | Recurring categories with no transaction yet this month whose last-month day is within the next 7 days |
| `saving.income` | Net of the Income system category |
| `saving.toGoals` | Net into goal categories |
| `saving.saved`, `saving.rate` | `income − bills.paid − spending.spent`, and that over income |
| `history` | Last 12 complete months: spending budget vs spent per month |
| `attention` | Uncategorized count, overspent categories (spent > budget) |

Status rule for the pill: spent ≤ expected pace is **On track**, ≤ 110% of pace is **Watch**, above that is **Over pace**, and spent > budget is **Over budget**. Expected pace = `spending.budget × dayOfMonth / daysInMonth`.

Uncategorized money out counts as spending. That keeps "left to spend" conservative and nudges the user to categorize.

### 2c. UI

Replace `app/(main)/page.tsx` with the Home layout from the mock-up. Suggested components in `components/features/home/`:

- `budget-status-card.tsx`: "left to spend" headline, status pill, month stepper (reuse `components/features/budget/period-navigator.tsx`), pace chart (cumulative spend vs dotted budget pace, today marker).
- `budget-history-strip.tsx`: 12 bars against a budget line, red when over, "9 of 12 on budget".
- `summary-tiles.tsx`: Spending, Bills, Saved (with tooltip "$X to goals, $Y kept in cash").
- `net-worth-card.tsx`: total, change for the selected range, area chart from snapshots, range chips (1M, 3M, YTD, 1Y, All, default 1Y), "Saved this month" and "Other changes" (net worth change minus saved).
- `attention-strip.tsx`: chips linking to the review inbox, the overspent category in Budget, and the bill's category.

Rules:
- Every number links to the page that owns it.
- No page-wide All / Year toggle.
- If the user has no portfolio accounts, the net worth card becomes an "Add your accounts" prompt.
- Keep the existing cash flow and category charts below the fold for now, switched to rolling windows (3M, 6M, 12M). Their redesign is out of scope.

Exit check: with the test data, October 2026 shows rent, internet and similar under Bills, TFSA/RRSP/Emergency under Saving, and the pace line has no jump on the 1st.

## Phase 3: Portfolio becomes Accounts (after Phase 2 ships)

1. Rename the sidebar entry in `components/features/layout/app-sidebar.tsx` to "Accounts". Keep the `/portfolio` route or redirect it.
2. Remove the net worth hero chart from the Portfolio page (it now lives on Home). Keep bucket cards, allocation (owned assets only) and history.
3. Add month-over-month change to each bucket card.
4. Full "what moved net worth" attribution (saved, market change, debt paid) waits for the goals refactor, since it depends on knowing which accounts goals map to.

## Out of scope

- Goals refactor (planned separately, after this).
- Recurring-bill auto-detection.
- Redesign of the cash flow and category trend charts.
- Mobile layout pass (do one after Phase 2 UI lands).
