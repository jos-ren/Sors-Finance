# Keyword Conflict Detection — Current State & Gap

Status: **partially implemented**. This documents how cross-keyword conflicts
are handled today, a worked example ("cost" vs. "costco"), and a known gap
left for later.

## How a multi-category match resolves today

See `findMatchingCategories` in `lib/categories/categorizer.ts`. For a given
transaction:

1. Every category's keywords are checked against the transaction's
   `matchField`. Any category with a matching keyword is a candidate.
2. Each candidate's *specificity* is the most specific mode among its own
   matching keywords, via `MODE_SPECIFICITY` (`lib/categories/keyword.ts`):
   `contains` (0) < `startsWith` (1) < `exact` (2).
3. Only candidates at the single highest specificity tier survive. If exactly
   one survives, the transaction is auto-categorized to it. If two or more tie
   at the top tier, the transaction is left `isConflict: true`,
   `categoryId: null` — surfaced in the Review Inbox for manual resolution,
   never silently guessed.

## Worked example: "cost" vs. "costco"

Category A has keyword `"cost"` (contains). Category B has keyword `"costco"`
(contains). Transaction description: `"COSTCO WHOLESALE #445"`.

- Both keywords match (both are substrings of the description).
- Both are `contains` → same specificity (0) → **tie** → transaction is
  flagged as an unresolved conflict, not auto-assigned.

**Fix, no code change needed:** set `"costco"` to `startsWith` or `exact` on
category B. It now outranks `"cost"` (specificity 0) for any transaction
containing "costco", so it resolves automatically to B, while `"cost"` still
freely matches everything else containing that substring (e.g. "cost plus").
This is the same mechanism documented in `docs/keyword-match-modes.md` for the
"amazon" vs. "amazon prime" case.

## Known gap: no substring-overlap warning across *different* keyword texts

The Settings → Keywords page (`app/(main)/settings/keywords/page.tsx`) shows a
warning badge on a keyword pill when another category uses the **identical**
keyword text (`classifyKeywordConflict`, built from a `KeywordIndex` keyed by
exact lowercased text):

- **Tie** (amber, `TriangleAlert`) — another category has the same text at the
  same specificity; the categorizer can't resolve which wins.
- **Shadowed** (muted, `EyeOff`) — another category has the same text at a
  *more* specific mode, so it always wins on the overlap.

This index is keyed by exact text equality, so it does **not** catch the
"cost" vs. "costco" case — those are different strings, one a substring of the
other. Detecting that would require an O(n²) substring-containment scan across
every keyword pair in every category (every keyword against every other
keyword, in both directions, respecting mode), which is meaningfully heavier
than the current exact-text index and was deliberately deferred.

The only signal a user gets for a substring-overlap conflict today is the
transaction itself landing in the Review Inbox as a conflict after import —
there's no proactive warning in the Keywords settings UI.

## Possible future work

- Add a substring/prefix-overlap scan to the Keywords settings page (heavier:
  O(n²) over all keyword pairs, must respect each keyword's own mode when
  deciding whether an overlap is even reachable — e.g. an `exact` keyword only
  overlaps another if the texts are literally equal, not merely substrings).
- Surface it the same way as today's exact-match warnings (tie vs. shadowed),
  reusing `MODE_SPECIFICITY` for the same win/tie logic.
- Consider doing this scan server-side/on-demand rather than in the client
  render path, since it scales quadratically with total keyword count.
