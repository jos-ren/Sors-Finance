# CLAUDE.md

This file provides guidance to Agents when working with code in this repository.

## Project Overview

A local-first Next.js web application for budget tracking, transaction categorization, and net worth tracking. Data persists in SQLite via Drizzle ORM. Supports scheduled portfolio snapshots when running in Docker.

**Theme**: shadcn/ui Maia style with zinc base color and lime accent.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Run Drizzle migrations
npm run db:studio    # Open Drizzle Studio
```

## Architecture

### App Structure (Next.js App Router)

- `/` - Dashboard with charts (income vs expenses, category breakdown)
- `/transactions` - Import history + transaction data table
- `/budget` - Budget categories with spending progress
- `/categories` - Category management with keywords
- `/portfolio` - Net worth tracking (savings, investments, assets, debt)
- `/settings` - App settings and data management

Sidebar navigation in `components/AppSidebar.tsx`, wrapped by `SidebarLayout.tsx`.

### Transaction Import Flow

1. **File Upload** → Bank auto-detected via parser registry (filename patterns + content validation)
2. **Parsing** → Bank-specific parsers convert to unified `Transaction` format
3. **Categorization** → Keyword matching against categories (case-insensitive, partial match)
4. **Resolution** → User resolves conflicts (multi-category matches) and unassigned transactions
5. **Results** → Transactions saved via API to SQLite

### Bank Parser Architecture (Extensible)

The parser system uses a registry pattern for easy extension. To add a new bank:

1. Create `lib/parsers/banks/yourbank.ts` implementing `BankParser` interface
2. Register in `lib/parsers/index.ts`
3. See `lib/parsers/banks/_template.ts` for a starter template
4. See `lib/parsers/README.md` for full documentation

**Parser files:**
- `lib/parsers/types.ts` - BankParser interface and types
- `lib/parsers/utils.ts` - Shared parsing utilities
- `lib/parsers/index.ts` - Registry with `detectBank()`, `parseFile()`, `getAllBankMeta()`
- `lib/parsers/banks/*.ts` - Individual bank implementations

### Database Architecture

Uses SQLite with Drizzle ORM. Data flows: Client → API Routes → SQLite.

**Schema & Connection (`lib/db/`):**
- `schema.ts` - Drizzle schema definitions (8 tables)
- `connection.ts` - SQLite connection with WAL mode
- `migrate.ts` - Migration runner for app startup
- `seed.ts` - Default category seeding
- `types.ts` - TypeScript type definitions
- `index.ts` - Barrel export

**API Routes (`app/api/`):**
- `categories/` - Category CRUD, reordering
- `transactions/` - Transaction CRUD, bulk operations, aggregations
- `budgets/` - Budget CRUD, copy operations
- `imports/` - Import history
- `settings/` - Key-value settings
- `portfolio/` - Accounts, items, snapshots, summary
- `scheduler/` - Snapshot schedule configuration
- `migrate/` - Data migration endpoint

**Client Wrappers (`lib/db/client/`):**
- Fetch-based API wrappers matching old function signatures
- Used by hooks for data access

**Hooks (`lib/hooks/useDatabase.ts`):**
- SWR-based hooks for reactive data fetching
- Cache invalidation helpers
- ~30 hooks for all data operations

### Sync and Snapshot Logic

The app has two separate but related concepts: **syncing** (updating current data) and **snapshots** (recording historical data).

#### Currency Exchange Rate Caching

To minimize API calls, exchange rates are cached in the database with a 24-hour lifetime:

**3-Layer Cache System:**
1. **In-Memory Cache** - 1 hour (fastest, but resets on server restart)
2. **Database Cache** - 24 hours (persistent across restarts)
3. **API Fallback** - Frankfurter API (free, no key required)

**Pre-warming Strategy:**
- During "Sync All", first-load snapshot, and scheduled snapshot
- System identifies all currency pairs needed for user's portfolio (e.g., USD→CAD, EUR→CAD)
- Fetches fresh rates for all pairs in parallel (batch of 5 at a time)
- Stores in database for 24 hours
- Dramatically reduces redundant API calls during portfolio rendering

**Key Files:**
- `lib/currency-cache.ts` - Cache warming utilities
- `app/api/exchange-rate/route.ts` - Exchange rate endpoint with 3-layer cache

#### Syncing ("Sync All" Button)

**What it does:**
1. Pre-warms currency cache with all needed exchange rates
2. Updates Plaid account balances from your bank (if Plaid is connected)
3. Refreshes current prices for all investments (stocks, crypto, metals)
4. Automatically creates/updates today's snapshot after syncing

**How it works:**
- User clicks "Sync All" button → calls `/api/plaid/balances`
- Syncs all connected Plaid accounts and captures any errors
- Refreshes prices for all portfolio items (stocks, crypto, metals) by routing to correct API:
  - Stocks → Finnhub API (with Yahoo fallback)
  - Crypto → CoinGecko API (no key required)
  - Metals → Metals API (no key required)
- Returns detailed results with accounts synced/failed and prices updated/failed
- After successful sync, automatically calls `/api/portfolio/snapshots/today` to create/update today's snapshot
- Shows expandable banner at top of portfolio page with detailed sync results

**Error handling:**
- Continues even if some accounts or items fail
- Collects all errors and shows them to user in expandable details
- Requires Finnhub API key only if stocks are present

#### Snapshots (Historical Records)

**What they are:**
- Point-in-time records of your portfolio (total savings, investments, assets, debt, net worth)
- Used to build net worth charts and track changes over time
- One snapshot per day (creates new or updates existing)

**When they're created:**

1. **After "Sync All" button** (always)
   - After syncing accounts and refreshing prices, automatically creates/updates today's snapshot
   - Uses fresh data from the sync that just completed

2. **First app load of each day** (once per day)
   - App checks localStorage for last snapshot date
   - If it's a new day, triggers snapshot creation
   - Respects scheduler settings (can optionally sync Plaid and refresh prices first)
   - Runs silently in background 2 seconds after app loads

3. **Scheduled (cron job)** (optional, production only)
   - Runs at configured time (default: 3 AM daily)
   - Only runs in production mode (`NODE_ENV=production`)
   - Respects scheduler settings (can optionally sync Plaid and refresh prices first)
   - Enabled/disabled via Settings page

**Snapshot Settings (in Settings page):**
- `SNAPSHOT_ENABLED` - Whether scheduled snapshots run (true/false)
- `SNAPSHOT_SCHEDULE_TIME` - What time scheduled snapshots run (default: "03:00")
- `PLAID_SYNC_WITH_SNAPSHOT` - Sync Plaid accounts before creating snapshot (true/false)
- `PRICE_REFRESH_WITH_SNAPSHOT` - Refresh investment prices before creating snapshot (true/false)

**Important:** The "Sync All" button always creates a snapshot after syncing (ignores settings), but first-load and scheduled snapshots respect the settings.

#### Key Files

**Sync:**
- `components/plaid/PlaidSyncButton.tsx` - "Sync All" button and snapshot trigger
- `components/plaid/PlaidSyncBanner.tsx` - Expandable results banner
- `app/api/plaid/balances/route.ts` - Main sync endpoint (currency cache → accounts → prices)

**Snapshots:**
- `app/(main)/layout.tsx` - First-load detection (checks localStorage)
- `app/api/portfolio/snapshots/first-load/route.ts` - First-load snapshot handler (includes cache warming)
- `app/api/portfolio/snapshots/today/route.ts` - Creates/updates today's snapshot
- `lib/scheduler.ts` - Scheduled snapshot task (cron job with cache warming)
- `instrumentation.ts` - Initializes scheduler on app startup

**Currency Caching:**
- `lib/currency-cache.ts` - Cache warming utilities, identifies needed pairs
- `app/api/exchange-rate/route.ts` - 3-layer cache (memory → database → API)
- `lib/db/schema.ts` - `currencyExchangeRates` table definition

### Scheduler

Scheduled tasks run via node-cron (production only).

- `lib/scheduler.ts` - node-cron scheduler
- `instrumentation.ts` - Next.js startup hook
- Only active in production (`NODE_ENV=production`)
- Configurable via Settings page

### Docker

```bash
docker compose up -d    # Start container
docker compose down     # Stop container
```

Data persists in `sors-data` volume. Port bound to localhost only (127.0.0.1:3000).

### Other Key Modules

- `lib/constants.ts` - Shared constants (BUCKET_TYPES, SYSTEM_CATEGORIES, etc.)
- `lib/formatters.ts` - Formatting utilities (currency, dates, percentages)
- `lib/categorizer.ts` - Keyword matching and categorization logic
- `lib/types.ts` - TypeScript interfaces (Transaction, Category, etc.)

### UI Components

Located in `components/`:
- `AppSidebar.tsx` - Main navigation sidebar
- `SidebarLayout.tsx` - Layout wrapper with SidebarProvider
- `TransactionImporter.tsx` - Full import wizard (upload → resolve → results)
- `TransactionDataTable.tsx` - Transaction list with filtering/sorting
- `FileUpload.tsx` - Drag/drop file upload with bank detection
- `CategoryManager.tsx` - CRUD for categories with drag-to-reorder (dnd-kit)
- `ConflictResolver.tsx` - Handle transactions matching multiple categories
- `UncategorizedList.tsx` - Assign categories to unmatched transactions
- `DatabaseProvider.tsx` - Database initialization wrapper

Radix UI primitives in `components/ui/` (shadcn/ui Maia style). Charts use Recharts via shadcn/ui chart component.

### State Management

- React useState/useEffect for UI state
- SWR for server state (caching, revalidation)
- SQLite for persistent data (via API routes)
- Context providers for theme, privacy mode, page header, and snapshots

## Path Alias

`@/*` maps to `./` (configured in tsconfig.json) - no `src/` prefix in this project.

## Dependencies of Note

- `better-sqlite3` - SQLite database driver
- `drizzle-orm` - TypeScript ORM for SQLite
- `swr` - React hooks for data fetching
- `node-cron` - Scheduled task runner
- `papaparse` - CSV parsing
- `xlsx` - Excel parsing
- `@dnd-kit/*` - Drag and drop for category reordering
- `sonner` - Toast notifications
- `recharts` - Charts (via shadcn/ui)
- `@tanstack/react-table` - Data tables
