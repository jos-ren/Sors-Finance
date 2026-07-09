# Keyword Match Modes

Status: **implemented**. A keyword now carries a match mode, not just text.

## Current behavior

A category's `keywords` is `Array<{ text: string; mode: "contains" | "startsWith" | "exact" }>`
(`Keyword` in `lib/db/types.ts`). Matching is case-insensitive and mode-aware,
via `matchesKeyword` (`lib/categories/keyword.ts`), used by
`findMatchingCategories` (`lib/categories/categorizer.ts`):

- **Contains** (default) — substring match.
- **Starts with** — description begins with the text.
- **Exact match** — description equals the text.

"Contains" stays the default because bank descriptions are messy (banks append
dates / transaction IDs, e.g. `Freelance Payment - Design Client 08-2026`), so an
overly strict rule would silently stop matching next month.

This runs against a transaction's `matchField` in the same three places as before:

- **Import pipeline** — `components/features/transactions/import-dialog.tsx`
- **Server re-match on keyword edit** — `app/api/budget/subcategories/[id]/route.ts`,
  `app/api/categories/[id]/route.ts` (both now use `matchesKeyword` instead of a
  local `.includes()`)
- **Server re-match on unlock** — `app/api/transactions/[id]/route.ts` (via
  `buildMatchables` → `findMatchingCategories`)

The Review Inbox rule composer (`components/features/transactions/review-inbox.tsx`)
has a mode dropdown in place of the old fixed "contains" text:

> Create rule: If description **[ contains ▾ ]** `[ text ]`, categorize as `[ Category ]`

The keyword settings page (`app/(main)/settings/keywords/page.tsx`) and the
per-category keyword editor (`components/features/budget/category-detail-dialog.tsx`)
both show a small mode selector on every keyword chip and on the add-keyword row.

## Storage / migration

`DbCategory.keywords` and `DbBudgetSubcategory.keywords` are `Keyword[]`
(`lib/db/schema.ts` JSON columns typed via `lib/db/types.ts`). The
`keyword_match_modes_v1` data migration (`lib/db/migrate-keyword-modes.ts`,
run from `lib/db/data-migrations.ts`) converts any pre-existing `string[]`
rows to `{ text, mode: "contains" }` once, idempotently. `normalizeKeywords`
(`lib/categories/keyword.ts`) does the same coercion at every write boundary
(API routes, `/api/data` import) so legacy exports and old client payloads
still work.

## Amazon vs. Amazon Prime

This was the motivating case: a broad "amazon" keyword (Shopping) would also
catch "Amazon Prime" (Subscriptions) under contains-only matching. Two things
now help:

- The built-in global merchant dictionary (`lib/categories/global-dictionary.ts`)
  has a dedicated "amazon prime" entry checked before the generic "amazon"
  entry, so the day-one suggestion for a Prime charge resolves to Subscriptions.
- Once a user has their own keywords, they can set the "amazon" keyword to
  `startsWith`/`exact`, or give "amazon prime" its own more specific rule, to
  avoid the two colliding as a multi-keyword conflict.
