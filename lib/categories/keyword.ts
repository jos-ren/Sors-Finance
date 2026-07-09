/**
 * Keyword match modes — shared helpers for the keyword-based auto-categorizer.
 *
 * A category's `keywords` is an `Array<{ text, mode }>` (see `Keyword` in
 * `lib/db/types.ts`). "Contains" (substring) is the default — bank
 * descriptions are messy (banks append dates/transaction IDs), so an overly
 * strict rule would silently stop matching next month. "Starts with" and
 * "Exact match" exist to disambiguate cases like "amazon" (Shopping) vs.
 * "amazon prime" (Subscriptions), where a broad contains-rule on one keyword
 * would swallow the other.
 */

import type { Keyword, KeywordMatchMode } from "@/lib/db/types";

const VALID_MODES: KeywordMatchMode[] = ["contains", "startsWith", "exact"];

/**
 * Relative precision of each mode — higher wins when two keywords with the
 * same text but different modes both match a transaction (see
 * `findMatchingCategories` in `lib/categories/categorizer.ts`, and the
 * cross-category conflict warnings on the keyword settings/editor UIs).
 */
export const MODE_SPECIFICITY: Record<KeywordMatchMode, number> = {
  contains: 0,
  startsWith: 1,
  exact: 2,
};

/** True if `text` satisfies `keyword` under its match mode (case-insensitive). */
export function matchesKeyword(text: string, keyword: Keyword): boolean {
  const t = text.toLowerCase();
  const k = keyword.text.toLowerCase();
  if (!k) return false;
  switch (keyword.mode) {
    case "exact":
      return t === k;
    case "startsWith":
      return t.startsWith(k);
    case "contains":
    default:
      return t.includes(k);
  }
}

/**
 * Coerce arbitrary stored/imported data into `Keyword[]`. Accepts legacy
 * plain strings (pre-match-modes exports/rows) and already-shaped objects;
 * drops anything else. Missing/invalid `mode` defaults to "contains".
 */
export function normalizeKeywords(raw: unknown): Keyword[] {
  if (!Array.isArray(raw)) return [];
  const out: Keyword[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      const text = entry.trim();
      if (text) out.push({ text, mode: "contains" });
    } else if (entry && typeof entry === "object" && typeof (entry as { text?: unknown }).text === "string") {
      const text = (entry as { text: string }).text.trim();
      if (!text) continue;
      const mode = (entry as { mode?: unknown }).mode;
      out.push({ text, mode: VALID_MODES.includes(mode as KeywordMatchMode) ? (mode as KeywordMatchMode) : "contains" });
    }
  }
  return out;
}

/** Dedupe by (mode, lowercased text), first occurrence wins. */
export function dedupeKeywords(keywords: Keyword[]): Keyword[] {
  const seen = new Set<string>();
  const out: Keyword[] = [];
  for (const k of keywords) {
    const key = `${k.mode}:${k.text.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(k);
    }
  }
  return out;
}
