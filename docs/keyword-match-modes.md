# Keyword Match Modes (planned)

Status: **planned / deferred**. Today keyword matching is **"contains" only**.

## Current behavior

A category's `keywords` is a `string[]`. Matching is a case-insensitive substring
test in `findMatchingCategories` (`lib/categories/categorizer.ts`):

```ts
category.keywords.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()))
```

This runs against a transaction's `matchField` in three places:

- **Import pipeline** — `components/features/transactions/import-dialog.tsx`
- **Server re-match on keyword edit** — `app/api/budget/subcategories/[id]/route.ts`,
  `app/api/categories/[id]/route.ts`
- **Server re-match on unlock** — `app/api/transactions/[id]/route.ts`

The Review Inbox rule composer (`components/features/transactions/review-inbox.tsx`)
therefore always creates a plain "contains" keyword. Its UI reads:

> Create rule: If description **contains** `[ text ]`, categorize as `[ Category ]`

The word "contains" is fixed text — there is no mode selector yet.

## The planned feature

Let a rule choose how the text is matched:

- **Contains** (default) — substring match (current behavior).
- **Starts with** — description begins with the text.
- **Exact match** — description equals the text.

"Contains" stays the default because bank descriptions are messy (banks append
dates / transaction IDs, e.g. `Freelance Payment - Design Client 08-2026`), so an
overly strict rule would silently stop matching next month.

## What a full implementation touches

Match modes are **cross-cutting** — the keyword needs to remember its mode, and
every matcher must honor it:

1. **Storage** — change `keywords: string[]` to carry a mode, e.g.
   `keywords: Array<{ text: string; mode: "contains" | "startsWith" | "exact" }>`
   on both `DbCategory` and `DbBudgetSubcategory` (`lib/db/types.ts`,
   `lib/db/schema.ts` JSON columns). A migration must convert every existing
   string keyword to `{ text, mode: "contains" }`.
2. **Matcher** — `findMatchingCategories` applies the per-keyword mode instead of a
   flat `includes`.
3. **Server routes** — the three re-match paths above read the mode.
4. **Keywords settings page** — `app/(main)/settings/keywords/page.tsx` renders each
   keyword with its mode and lets the user change it.
5. **Rule composer** — swap the fixed "contains" text for a small mode dropdown,
   defaulting to "Contains".

Until then, the composer's sibling/bulk-apply preview and the created keyword both
use "contains" semantics.
