# Projects Plan

Replace Goals with **Projects**: time-bound labels on transactions that group spending across categories and months (Japan trip, Moving out, New car). Goals become plain **saving categories**.

Background, research and decisions: [`docs/spikes/goals-to-projects.md`](../spikes/goals-to-projects.md).

## Status

All six phases are implemented on branch `feat/projects` (2026-10-15). Verified with lint and API checks against the dev server; UI testing is manual.

## Decisions (summary)

- **Category vs project:** the category says *what* (Flights). The project says *why* (Japan trip). Pick the category as if the project didn't exist, never Excluded.
- **Projects per transaction:** at most one, via `transactions.projectId`, which sits alongside the one-FK rule.
- **Funding switch:** each project has "Funded separately", on by default and flippable any time. When it's on:
  - The project's spending is left out of the monthly spending math, Budget page category actuals and Home pace.
  - It is shown as its own line instead.
  - It still counts against Saved.
- **Project budget:** one total per project. The category breakdown shows actuals only.
- **Assigning:**
  - Bulk action and an edit dialog picker.
  - Date-window suggestions, which never auto-assign.
  - Project keywords, which auto-assign on import but only within the project's dates.
- **Navigation:** Projects replaces Goals at the top level. Saving categories live only in the Budget tree.
- **Goals:** `itemType: "goal"` becomes `"saving"`. "Spent" and "available" are removed; progress is lifetime contributions against an optional target.

## Phase 1: Data model and API

- [x] **Schema** in `lib/db/schema.ts`:
  - New `projects` table: `id`, `uuid`, `userId`, `name`, `color`, `startDate`, `endDate` (nullable), `budget` (nullable), `fundedSeparately` (boolean, default true), `keywords` (JSON `Keyword[]`), `fundCategoryId` (nullable, references `budget_subcategories.id`, set null on delete), `notes`, `isArchived`, `createdAt`, `updatedAt`.
  - Add `projectId` to `transactions` (nullable, references `projects.id`, set null on delete), with an index on `(userId, projectId)`.
- [x] Run `npm run db:generate -- --name add_projects` to create migration `0023`.
- [x] **Types** in `lib/db/types.ts`:
  - `DbProject`, and `projectId` on `DbTransaction`.
  - `ProjectStatus = "upcoming" | "active" | "done"`, derived from the dates.
- [x] **`lib/projects/projects-db.ts`** (with `dates.ts` and `types.ts` alongside):
  - Per-project totals: spent, by category, by month, transaction count.
  - Status.
  - Fund info: lifetime net transfers into `fundCategoryId` (actual money set aside, not planned amounts).
  - Suggestions: unassigned, non-Excluded transactions with money out, inside the date window.
- [x] **API:**
  - `app/api/projects/route.ts`: GET (list with totals) and POST.
  - `app/api/projects/[id]/route.ts`: GET (detail, breakdowns, suggestions), PUT and DELETE. Deleting a project only clears `projectId`.
- [x] **Transactions API:**
  - Accept `projectId` in `app/api/transactions/route.ts` (POST, plus a `?projectId=` filter), `[id]/route.ts` (PUT) and `bulk/route.ts` (import).
  - New `PATCH /api/transactions/project` (`{ ids, projectId | null }`) for bulk assign and unassign.
  - Validate that the project belongs to the user.
- [x] **Client and hooks:**
  - `lib/db/client/projects.ts`, exported from `index.ts`.
  - `hooks/use-projects.ts`, exported from `@/hooks`.
  - Add a `projects/` SWR prefix.
  - `invalidateTransactions` also invalidates `projects` and `home`.
- [x] **Backup:** export and import `projects` and `transactions.projectId` in `app/api/data/route.ts`, remapping IDs like the other tables. Older backups without projects still import.

## Phase 2: Projects pages and navigation

- [x] **Sidebar** (`components/features/layout/app-sidebar.tsx`): replace Goals with Projects (`/projects`).
- [x] **`app/(main)/projects/page.tsx`:**
  - Cards grouped Active, Upcoming, Done, with archived ones hidden behind a toggle.
  - Each card shows name, colour, dates, spent of budget and a "Funded separately" badge.
- [x] **`components/features/projects/project-dialog.tsx`** (create and edit):
  - Name, colour, start and end date, budget.
  - "Funded separately" switch with one line of help text.
  - Keywords, using the same editor as categories.
  - Fund link: a picker of saving categories.
- [x] **`app/(main)/projects/[projectId]/page.tsx`:**
  - Header: total of budget, dates, status, edit, archive.
  - By category: bars with percentages.
  - By month: bars.
  - Fund card, when linked: "Set aside $X in {fund}, spent $Y".
  - Transactions list.
  - Suggestions list with Add and Add all.
- [x] **Page header and breadcrumbs** through `useSetPageHeader`.
- [x] **Redirects:** `/goals` and `/goals/[id]` go to `/projects`, via `redirects` in `next.config`.

## Phase 3: Assigning transactions

- [x] **Transactions table** (`components/features/transactions/transaction-data-table.tsx`):
  - A Project column showing a colour chip.
  - A Project filter.
  - "Add to project…" and "Remove from project" bulk actions.
- [x] **Edit and add dialogs** (`edit-transaction-dialog.tsx`, `add-transaction-dialog.tsx`): a Project picker next to Category. Active and upcoming projects are listed first.
- [x] **Project keywords on import:**
  - New `lib/projects/match.ts`. It reuses the match modes in `lib/categories/keyword.ts`, and a keyword only matches when the transaction date is inside the project window.
  - `import-dialog.tsx` applies it after categorization and before insert.
  - If more than one project matches, leave the row unassigned and let suggestions handle it.
- [x] **Review inbox** (`review-inbox.tsx`): show the project chip on rows that have one.

## Phase 4: Monthly integration

- [x] **`lib/budget/classify.ts`:**
  - Add `classifyTransaction(category, project)`, returning `"bill" | "saving" | "spending" | "project"`.
  - A separately funded project takes priority over the category's class.
  - `classifyCategory` stays for budget rows.
- [x] **`app/api/home/route.ts` and `lib/budget/home-types.ts`:**
  - Separately funded project transactions leave `spending.spent`, `cumulativeByDay` and `bills.paid`.
  - New `projects: { id, name, color, spent }[]` for the month.
  - `saving.saved = income − bills − spending − projects`.
  - `history[]` gains `projectSpent`.
  - `projected` accounts for project spend so far.
- [x] **Home UI:**
  - `budget-status-card.tsx`: history bars stack project spend in a muted shade, and the tooltip names the projects. A month counts as over budget on everyday spending only.
  - `summary-tiles.tsx`: Saved shows a "$X to {project}" line.
  - A "This month includes $X for {project}" chip linking to the project, in `attention-strip.tsx` or under the budget card.
- [x] **Budget page:**
  - `app/api/budget/tree/route.ts` and `lib/budget/effective-tree.ts`: category and group `actual` exclude separately funded project spend, and a new `projectSpend: { projectId, name, amount }[]` is added per category.
  - `budget-item-row.tsx`: a "+$X in {project}" note linking to the project.
- [x] **Yearly summary** (`app/api/budgets/yearly-summary/route.ts`): same exclusion, plus a per-month project total.
- [x] **Money flow Sankey** (`money-flow-sankey.tsx`): one "Projects" outflow node with a child per project.
- [x] **Trends:**
  - `app/api/transactions/aggregations/route.ts` returns separately funded project spend as its own series.
  - `trends-section.tsx` draws it in Money in vs out and Spending by group.
- [x] **Category detail page** (`app/(main)/budget/category/[categoryId]/page.tsx`): mark project transactions with a chip.

## Phase 5: Goals to saving categories

- [x] **Types:** `BudgetItemType` becomes `"expense" | "saving"` in `lib/db/types.ts` and `lib/budget/types.ts`.
- [x] **Data migration**: custom SQL migration `drizzle/0024_goals_to_saving.sql` turns `item_type = 'goal'` into `'saving'` (runs once through the drizzle journal, so no marker row is needed). `toItemType()` also maps `"goal"` on input, and the legacy collapse migration now writes `"saving"`.
- [x] **Import compatibility:** `app/api/data/route.ts` maps `"goal"` to `"saving"` on import, and carries `targetDate` (fixes the round-trip bug).
- [x] **`lib/budget/classify.ts`:** `saving` maps to "saving".
- [x] **Remove the goal math:**
  - Delete `lib/budget/goals-db.ts`, `app/api/goals/*`, `lib/db/client/goals.ts`, `hooks/use-goals.ts`, `app/(main)/goals/*` and `goal-fund-meter.tsx`.
  - Delete the `goalProgress` case in the aggregations route.
- [x] **Budget tree:**
  - `app/api/budget/tree/route.ts` drops `cumulative`, `spent` and `available`; `contributed` is lifetime net transfers into the category (actual money set aside, matching the project fund). Saving actuals now count in group and total actuals.
  - `budget-item-row.tsx` and `saving-progress.tsx` (renamed from `goal-progress.tsx`) show "$11,000 of $15,000" when a target is set.
  - Add a "Funding: {project}" link when a project points at the category.
- [x] **Category dialog** (`category-detail-dialog.tsx`): "Savings goal" becomes a "Saving" toggle with an optional target and target date. Recurring stays hidden for saving categories.
- [x] **Builder icons** (`builder-list.tsx`, `allocation-item-row.tsx`, `archived-items-sheet.tsx`) and the budget pages switch from `"goal"` to `"saving"`.
- [x] **Sankey:** saving categories roll into their group's value. This fixes the undersized Savings group.
- [x] **Seed defaults** (`lib/db/budget-hierarchy-data.ts`, `budget-seed.ts`):
  - Rename the group "Savings & Goals" to "Savings".
  - Keep Emergency Fund and a "Travel Fund" as saving categories.
  - Drop Mirrorless Camera and New Desk, which are project-shaped.

## Phase 6: Test data and docs

- [x] **Generator** (scratchpad `gen.mjs`):
  - Change `itemType` from `"goal"` to `"saving"`.
  - Add the projects:
    - Japan trip: Jan to Apr 2026, separate, fund = Japan Trip Fund, keywords "TOKYO" and "JR EAST".
    - Tofino weekend: Jun 2025, monthly.
    - Moving out: future dates with a budget, so it shows as Upcoming.
  - Set `projectId` on their transactions.
  - Add a Transportation › Vehicle Purchase category with $0 planned.
- [x] Regenerate `sors-test-data.json`. The Japan trip's flights, hotels and spending were also removed from the monthly budgets, since the trip is funded separately.
- [x] **Docs:** update `README.md` (Features, How Budgeting Works) and `AGENTS.md`:
  - Routes, the Projects model, the classification seam, conventions for the `projectId` dimension, and the SWR prefix.
- [x] **Spike:** mark it as implemented, linking to this plan.

## Verification

There is no test framework. Run `npm run lint` after each phase. Per user preference, run no builds and no browser automation; the user tests the UI.

1. **Phase 1:** use `curl` with a session cookie for project CRUD and bulk assign. Export a backup, re-import it, and check that projects and `projectId` survive.
2. **Phases 2 and 3:** create Japan trip (Jan 1 to Apr 30, 2026) and confirm:
   - Suggestions list the flights, hotels and Tokyo transactions, and not unrelated Toronto spending outside the dates.
   - Keyword import tags only rows inside the dates.
3. **Phase 4,** with Japan trip funded separately:
   - January Flights shows the "+$1,684 in Japan trip" note.
   - The history bar is not red and has a muted segment.
   - April Saved subtracts $1,605 and says so.
   - With the switch off, everything returns to normal counts.
4. **Phase 5:** after migration, the four old goals show as saving categories with contributions against target, and nothing reads 0 available. `/goals` redirects. Home saving numbers are unchanged for months without projects.
5. **Phase 6:** import the regenerated test data and check that the worked example in the spike matches: $4,926 spent, $3,600 set aside, and the category split.
