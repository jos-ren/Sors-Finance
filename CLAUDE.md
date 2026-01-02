# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A local-first Next.js web application for budget tracking, transaction categorization, and net worth tracking. **All processing happens client-side** — no transaction data is sent to servers. Data persists in IndexedDB via Dexie.

**Theme**: shadcn/ui Maia style with zinc base color and lime accent.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
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
5. **Results** → Transactions saved to IndexedDB

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

### Database Module (lib/db/)

Uses Dexie (IndexedDB wrapper). Split into focused modules:

- `types.ts` - Type definitions (DbTransaction, DbCategory, etc.)
- `instance.ts` - Database class and singleton
- `categories.ts` - Category CRUD operations
- `transactions.ts` - Transaction CRUD and aggregations
- `budgets.ts` - Budget operations
- `portfolio.ts` - Portfolio accounts, items, and snapshots
- `imports.ts` - Import tracking
- `settings.ts` - Key-value settings
- `seed.ts` - Default category seeding
- `index.ts` - Barrel export

Import from `@/lib/db` for all database operations.

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

Radix UI primitives in `components/ui/` (shadcn/ui Maia style). Charts use Recharts via shadcn/ui chart component.

### State Management

- React useState/useEffect for UI state
- IndexedDB via Dexie for persistent data (transactions, categories, budgets, portfolio)
- Context providers for theme, privacy mode, and snapshots

## Path Alias

`@/*` maps to `./` (configured in tsconfig.json) - no `src/` prefix in this project.

## Dependencies of Note

- `dexie` - IndexedDB wrapper for local-first data persistence
- `papaparse` - CSV parsing
- `xlsx` - Excel parsing
- `@dnd-kit/*` - Drag and drop for category reordering
- `sonner` - Toast notifications
- `recharts` - Charts (via shadcn/ui)
- `@tanstack/react-table` - Data tables
