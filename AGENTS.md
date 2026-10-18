# CLAUDE.md

This file provides guidance to Agents when working with code in this repository.

## Project Overview

A self-hosted Next.js app for zero-based budgeting, transaction categorization and net worth tracking. Data persists in SQLite via Drizzle ORM. Multi-user with local accounts (every row is scoped by `userId`). Supports scheduled net worth snapshots in production.

**Theme**: shadcn/ui Maia style (`radix-maia`) with zinc base color and lime accent.

## Commands

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm run lint         # Run ESLint
npm run db:generate  # Generate a Drizzle migration from lib/db/schema.ts
npm run db:migrate   # Apply migrations (also applied automatically on startup)
npm run db:studio    # Open Drizzle Studio
```

There is no test framework. Verify with `npm run lint` and by exercising the app. `sors-test-data.json` (repo root) is a realistic two-year backup to load via Settings → Import Data; it replaces the current user's data.

## Conventions and Gotchas

- **Months are 0-based** (0–11) everywhere: `budgets.month`, `planned_income.month`, API params, `?month=` deep links.
- **One-FK rule for transactions**: a transaction has at most one of `budgetItemId` (a budget category) or `categoryId` (a system category: Income / Excluded / Uncategorized). Both null means uncategorized. Enforced in code via `lib/budget/normalize-assignment.ts`.
- **NULL-safe filters**: because budget-assigned rows have `categoryId = NULL`, never filter with a bare `ne(categoryId, x)` (SQL `NULL != x` is unknown and drops the row). Use `or(isNull(categoryId), ne(categoryId, x))`.
- **Money classes go through one helper**: `lib/budget/classify.ts`. `classifyCategory()` returns `"bill" | "saving" | "spending"` (`itemType: "saving"` → saving, `isRecurring` → bill, else spending). `classifyTransaction()` / `isSeparateProject()` add `"project"`: a transaction in a project with `fundedSeparately` leaves the monthly spending math (Home pace, left to spend, Budget category actuals, yearly totals, trends) and is reported per project instead, but still counts against Saved. Do not read `itemType` / `isRecurring` / `fundedSeparately` directly for these decisions. `toItemType()` maps the legacy `"goal"` to `"saving"`.
- **Projects are a second dimension**: `transactions.projectId` (at most one project) sits alongside the one-FK category rule and never changes it. The category says what, the project says why. Assign through `PATCH /api/transactions/project` or the transaction routes; project keywords match only inside the project's date window (`lib/projects/match.ts`).
- **Naming**: in the DB the budget leaf is `budget_subcategories` and transactions reference it as `budgetItemId`; in the UI it is called a "Category" under a "Category Group". The `categories` table holds only the three system categories.
- **Migrations**: edit `lib/db/schema.ts`, run `npm run db:generate -- --name <name>`, commit the SQL and `drizzle/meta` files. One-off data transforms live in `lib/db/data-migrations.ts` (guarded by `data_migrations` marker rows).
- **New fields on categories** must be threaded through: `lib/db/types.ts`, `lib/db/client/budget-hierarchy.ts` inputs, the subcategory POST/PUT routes, `lib/budget/types.ts` + `app/api/budget/tree/route.ts`, and backup import in `app/api/data/route.ts`.
- **SWR cache keys** are invalidated by prefix (`invalidateTransactions`, `invalidateBudgets`, `invalidatePortfolio` in `hooks/use-database.ts`; `invalidateBudgetHierarchy`, `invalidateBudgetTree` in `hooks/use-budget.ts`). A new derived read model needs its prefix added (Home uses `home/…`; projects use `projects` and `project/<id>`, invalidated with transactions).
- **Amounts**: format with `usePrivacy().formatAmount(amount, currency, showCode)` so privacy mode masks them; chart axes use `formatAxisAmount` and round ticks from `lib/utils/chart-ticks.ts`.
- **Per-browser view preferences** (chart ranges and similar) use `usePersistentState` from `hooks/use-persistent-state.ts` (localStorage, hydration-safe).
- **Pages that read `useSearchParams`** on a static route must render inside `<Suspense>` (see `app/(main)/budget/page.tsx`).

## Architecture

### App Structure (Next.js App Router)

Routes under `app/(main)` require a session (`middleware.ts` checks the `sors_session` cookie); `app/(auth)` holds `/login` and `/register`.

- `/` - **Home**: budget status card (left to spend, pace chart, 12 month history), net worth card (range chips), Income / Bills / Saved tiles, Needs attention strip, rolling 3/6/12 month trends
- `/budget` - Monthly budget tree, money-flow Sankey, yearly totals; accepts `?year=&month=`
- `/budget/builder` - Edit groups, categories, keywords and planned amounts
- `/budget/category/[categoryId]` - Category detail for a month
- `/projects`, `/projects/[projectId]` - Projects: time-bound groups of transactions (trips, moves, big purchases) with totals by category and month, fund link and date-window suggestions. `/goals` redirects here (`next.config.ts`)
- `/transactions` - Review inbox, import, transaction table
- `/portfolio` - **Accounts** (labelled "Accounts" in the UI): net worth summary, allocation of owned assets, bucket cards with month change, history links
- `/portfolio/{savings,investments,assets,debt}` - Per-bucket accounts and items
- `/portfolio/history`, `/portfolio/snapshots` - Item change history and snapshot management
- `/settings` (+ `keywords`, `templates`, `snapshots`, `plaid`, `finnhub`, `logs`, `developer`) - Settings, data export/import

Sidebar: `components/features/layout/app-sidebar.tsx`. Page titles feed the sticky header via `useSetPageHeader` (`contexts/page-header-context.tsx`).

### Budget Model

Two levels: **Category Group → Category** (see `docs/budget-system-strategy.md`).

- Categories carry keywords, `itemType` (`expense` | `saving`), an optional `targetAmount` / `targetDate` for saving categories, and `isRecurring` for fixed monthly bills.
- Planned amounts are rows in `budgets` (one per category per month). `planned_income` holds an optional expected income per month.
- Saving categories (TFSA, Emergency Fund, a trip fund): progress = lifetime net transfers into the category (`contributed` on the budget tree) against the optional target.
- Projects (`projects` table, `lib/projects/`): name, colour, start date, optional end date, optional total budget, `fundedSeparately` (default true), keywords, optional `fundCategoryId` (a saving category), notes, archive. Status (upcoming / active / done) comes from the dates. Read models in `lib/projects/projects-db.ts`, types in `lib/projects/types.ts`, dates travel as `YYYY-MM-DD`. Spike and decisions: `docs/spikes/goals-to-projects.md`; plan: `docs/plans/projects-plan.md`.
- Default hierarchy for new users: `lib/db/budget-hierarchy-data.ts`, seeded by `lib/db/budget-seed.ts`.

### Home Summary

`GET /api/home?year=&month=` (`app/api/home/route.ts`, types in `lib/budget/home-types.ts`) computes in one pass over the selected month plus the previous 12:

- Spending budget, spent, cumulative-by-day pace, pace status
- Bills budget, paid, due soon (no transaction yet this month and last month's payment day within 7 days)
- Saving: income (Income category), planned to savings, separately funded project spending (`toProjects`), saved = income − bills − spending − project spending, rate, and for the current month a month-end projection (planned income or last month's income)
- `projects`: separately funded project spending in the month; each `history` month also lists its projects
- 12 month spending history; attention items (pending review, uncategorized, meaningful overspends)

Uncategorized money out counts as spending; Excluded rows are ignored. Plan and decisions: `docs/plans/home-dashboard-plan.md`.

### Transaction Import Flow

`components/features/transactions/import-dialog.tsx`:

1. **Source**: file upload (`.csv`, `.xlsx`, `.xls`) or Plaid
2. **Parsing**: parser registry (`lib/parsers`) with the custom column-mapping parser and auto-detection (`column-detection.ts`); mappings can be saved as templates (`custom_import_templates`)
3. **Dedup**: exact duplicates are silently discarded. Plaid rows dedup on `plaidTransactionId` instead (in `app/api/plaid/transactions/fetch/route.ts`); Plaid rows imported before ids were stored are matched up and backfilled through `POST /api/transactions/plaid-details`
4. **Categorization** (`lib/categories/categorizer.ts`): user keywords first (match modes in `lib/categories/keyword.ts`). A single match is trusted; multiple matches are a conflict
5. **Gap fill**: unmatched rows get a suggestion from the global dictionary (`lib/categories/global-dictionary.ts`), then from Plaid's own category when it is confident (`lib/categories/plaid-category.ts`)
6. **Insert** with `reviewStatus`: trusted matches are `reviewed`; conflicts, suggestions and unknowns are `pending` and appear in the review inbox (`review-inbox.tsx`), grouped by day with time, account, channel, place and the raw bank string

Plaid rows keep `description` as the clean merchant name; `matchField` joins merchant, Plaid `name` and `original_description` so keywords can target the raw bank text. Plaid days (`authorized_date`, else posted `date`) travel as `YYYY-MM-DD` and become local midnight on the client, like the file parsers. Extra bank context lives in `originalDescription`, `merchantName`, `transactedAt` (only when the bank sends a real time) and the `details` JSON (`TransactionDetails` in `lib/db/types.ts`).

### Bank Parser Architecture (Extensible)

1. Create `lib/parsers/banks/yourbank.ts` implementing `BankParser` (start from `_template.ts`)
2. Register it in `lib/parsers/index.ts`
3. See `lib/parsers/README.md`

Parser files: `types.ts` (interfaces), `utils.ts` (shared helpers, Excel via SheetJS), `index.ts` (`detectBank()`, `parseFile()`, `getAllBankMeta()`), `banks/custom.ts` (custom mapping parser).

### Database Architecture

SQLite with Drizzle ORM. Data flows: Client → API routes → SQLite.

**Schema & connection (`lib/db/`):**
- `schema.ts` - 21 tables: `users`, `sessions`, `categories`, `budget_groups`, `budget_subcategories`, `projects`, `transactions`, `budgets`, `planned_income`, `imports`, `settings`, `portfolio_accounts`, `portfolio_items`, `portfolio_item_history`, `portfolio_snapshots`, `custom_import_templates`, `currency_exchange_rates`, `system_logs`, `data_migrations`, `plaid_items`, `plaid_accounts`
- `connection.ts` - SQLite connection (WAL mode)
- `migrate.ts` - Runs Drizzle SQL migrations, then `data-migrations.ts`, on startup
- `seed.ts` - System categories and default settings per user
- `types.ts` - Shared TypeScript types (`SYSTEM_CATEGORIES`, `Db*` row types)

**Auth (`lib/auth/`):** bcrypt passwords, cookie sessions. API routes call `requireAuth(request)` from `lib/auth/api-helper.ts` and scope every query by `userId`.

**API routes (`app/api/`):** `auth`, `budget` (groups, subcategories, hierarchy, tree), `budgets` (planned amounts, copy, income, yearly summary), `categories`, `keywords`, `projects`, `home`, `transactions` (CRUD, bulk, project assignment, aggregations), `imports`, `custom-import-templates`, `portfolio` (accounts, items, history, snapshots, summary), `plaid`, `stock`, `crypto`, `metals`, `exchange-rate`, `integrations`, `scheduler`, `settings`, `system-logs`, `data` (export, import, clear).

**Client wrappers (`lib/db/client/`):** fetch-based functions per area, barrel-exported from `index.ts`.

**Hooks (`hooks/`):** SWR hooks in `use-database.ts` (transactions, aggregations, home, portfolio, snapshots, `useNetWorthRange`), `use-budget.ts` (hierarchy, tree, mutations), `use-projects.ts` (projects, mutations, `setTransactionsProject`), plus `use-persistent-state.ts`, `use-stock-price.ts`, `use-mobile.ts`. Import from `@/hooks`.

### Sync and Snapshot Logic

**Syncing** updates current data; **snapshots** record history.

#### Currency Exchange Rate Caching

Three layers: in-memory (1 hour) → database `currency_exchange_rates` (24 hours) → Frankfurter API (free, no key). The cache is pre-warmed (all pairs the user's portfolio needs, 5 at a time) during Sync All, the first-load snapshot and the scheduled snapshot.

- `lib/services/currency-cache.ts` - `warmCurrencyCache()`, needed pairs
- `app/api/exchange-rate/route.ts` - Rate endpoint with the 3-layer cache

#### Syncing ("Sync All" button)

1. Pre-warms the currency cache
2. Updates Plaid account balances (if connected)
3. Refreshes prices: stocks → Finnhub (Yahoo fallback, needs `FINNHUB_API_KEY`), crypto → CoinGecko, metals → metals API (`lib/services/quotes.ts`)
4. Creates or updates today's snapshot via `/api/portfolio/snapshots/today`

Continues past individual failures and reports them in an expandable banner.

- `components/features/plaid/plaid-sync-button.tsx` - Button and snapshot trigger
- `components/features/plaid/plaid-sync-banner.tsx` - Results banner
- `app/api/plaid/balances/route.ts` - Sync endpoint (currency cache → accounts → prices)

#### Snapshots

Point-in-time totals (savings, investments, assets, debt, net worth) plus per-account/item `details`. One per day (created or updated). Created:

1. **After Sync All** (always, ignores settings)
2. **First app load of each day**: `app/(main)/layout.tsx` checks `localStorage` (`lastSnapshotCheck`) and calls `/api/portfolio/snapshots/first-load` (respects settings)
3. **Scheduled** (production only, `NODE_ENV=production`): `lib/services/scheduler.ts` via node-cron, started from `instrumentation.ts` (respects settings)

Settings keys: `SNAPSHOT_ENABLED`, `SNAPSHOT_TIME` (default `03:00`), `TIMEZONE`, `PLAID_SYNC_WITH_SNAPSHOT`, `PRICE_REFRESH_WITH_SNAPSHOT`.

#### Plaid Connection Health

`lib/plaid/health.ts` reads each bank's state with `/item/get` (free; `/accounts/balance/get` is billed per call) and stores `plaid_items.status` (`active` | `login_required` | `error`). Checks are gated on the per-user `PLAID_HEALTH_CHECKED_AT` setting, not a clock, so a missed check runs on the next app load:

- App load (`app/(main)/layout.tsx`) → `POST /api/plaid/health`, Plaid asked when the last check is over 6 hours old
- Import account picker, Settings → Plaid, Sync All and the scheduled balance sync use a 30 minute window; Sync All and the scheduler skip `login_required` banks
- Production scheduler also runs it every 6 hours

Shown via `usePlaidHealth` / `usePlaidReconnectNeeded` (`hooks/use-database.ts`, key `plaid/health`, refreshed with `invalidatePlaidHealth`): red dot on Settings in the sidebar, Home "Needs attention" chip, marked bank in the import picker and Settings → Plaid, and a warning on linked Accounts items.

### Environment Variables

Server-only, read from `.env` (no example file is committed): `FINNHUB_API_KEY`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, optional `PLAID_SECRET_SANDBOX` / `PLAID_SECRET_PRODUCTION` (`lib/plaid/client.ts`).

### Docker

```bash
docker compose up -d    # Start container (needs a .env file, can be empty)
docker compose down     # Stop container
```

Data persists in the `sors-data` volume. Port bound to localhost only (`127.0.0.1:3000`).

### Other Key Modules

- `lib/constants/index.ts` - Shared constants (bucket types, system categories, API URLs, storage keys)
- `lib/utils/formatters.ts` - Currency (incl. compact axis), number, percent, date formatting
- `lib/utils/chart-ticks.ts` - `niceTicks()` round axis steps
- `lib/budget/` - `classify.ts`, `home-types.ts`, `types.ts` (tree shapes), `effective-tree.ts`, `hierarchy-db.ts`, `normalize-assignment.ts`
- `lib/projects/` - `projects-db.ts` (summaries, detail, suggestions, input validation), `types.ts`, `dates.ts`, `match.ts` (import keywords)
- `lib/categories/` - Categorizer, keyword match modes, global dictionary
- `lib/services/` - Quotes, currency cache, scheduler, system log
- `lib/icons/` - Bank, stock, crypto, account and asset logos

### UI Components

`components/features/`:
- `home/` - `budget-status-card`, `net-worth-card`, `summary-tiles`, `attention-strip`, `trends-section`, `card-title-link`
- `budget/` - Budget tree, summary hero, Sankey, period navigator, category detail dialog (keywords, Recurring bill and Saving toggles), builder, saving progress
- `projects/` - Project dialog, card, chip, select, delete dialog
- `transactions/` - Import dialog, file upload, column mapping, review inbox, data table, add/edit dialogs
- `portfolio/` - Bucket cards and pages, account sections, item dialogs, ticker search
- `plaid/` - Link button, bank connections, sync button and banner
- `layout/` - App sidebar, database provider

Primitives in `components/ui/` (shadcn/ui Maia). Charts use Recharts through the shadcn chart component (`components/ui/chart.tsx`).

### State Management

- React state for UI; SWR for server state
- SQLite for persistent data (via API routes)
- Contexts (`contexts/`): auth, settings (currency, timezone), privacy mode, page header, snapshot progress, currency rates, unsaved changes
- `localStorage` only for per-browser preferences (`usePersistentState`, privacy mode, first-load snapshot check)

## Path Alias

`@/*` maps to `./` (configured in `tsconfig.json`); there is no `src/` folder.

## Dependencies of Note

- `next` 16.1, `react` 19.2, `tailwindcss` 4
- `better-sqlite3`, `drizzle-orm` / `drizzle-kit` - Database
- `swr` - Data fetching
- `recharts` - Charts (via shadcn/ui)
- `@tanstack/react-table`, `@tanstack/react-virtual` - Tables
- `@headless-tree/react`, `@dnd-kit/*` - Budget tree and drag to reorder
- `papaparse`, `xlsx` - CSV and Excel parsing
- `node-cron` - Scheduled snapshots
- `plaid` - Bank connections
- `bcrypt` - Password hashing
- `sonner` - Toasts
- `date-fns` - Dates
