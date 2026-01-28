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

### Scheduler

Portfolio snapshots can run on a schedule (default: 3 AM daily).

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
