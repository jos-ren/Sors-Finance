/**
 * Global Merchant Dictionary
 *
 * A small, built-in master list of common merchants → the *kind* of category
 * they belong to. This gives new users a "day one" categorization experience
 * before they've built up any of their own keyword rules.
 *
 * It is intentionally a proof-of-concept: a static list here, expandable later
 * (or eventually a shared server-side database).
 *
 * How it resolves to a user's categories:
 *   - `patterns` are `Keyword`s (text + match mode) checked against a
 *     transaction's matchField via the same `matchesKeyword` a user's own
 *     keywords use — "contains" by default, but an entry can use "startsWith"
 *     or "exact" when it needs to be more specific.
 *   - `categoryStems` are fuzzy-matched against the *names* of the user's own
 *     categories. A stem like "grocer" matches a user category named
 *     "Groceries", "Grocery", or "Grocer" (via includes-in-either-direction).
 *
 * The dictionary never creates categories. If the merchant is known but the
 * user has no matching-named category, there's simply no suggestion.
 *
 * Precedence: the dictionary is only consulted for transactions the user's own
 * keywords left uncategorized (see the import pipeline). When a user approves a
 * dictionary suggestion in the review inbox, the matched pattern is promoted to
 * a real keyword (carrying the same match mode) on that category — so it stops
 * being a suggestion and starts auto-clearing on future imports.
 */

import type { Keyword } from "@/lib/db/types";
import { matchesKeyword } from "@/lib/categories/keyword";

export interface GlobalEntry {
  /** Matched (case-insensitive, mode-aware) against a transaction's matchField. */
  patterns: Keyword[];
  /** Lowercase category-name stems fuzzy-matched against the user's category names. */
  categoryStems: string[];
}

const contains = (text: string): Keyword => ({ text, mode: "contains" });

export const GLOBAL_DICTIONARY: GlobalEntry[] = [
  { patterns: [contains("trader joes"), contains("whole foods"), contains("grocery")], categoryStems: ["grocer"] },
  { patterns: [contains("netflix")], categoryStems: ["subscription", "stream", "entertain"] },
  // More specific "amazon prime" entry must come before the generic "amazon"
  // entry below — matchGlobalDictionary takes the first entry whose pattern
  // matches, so this keeps Prime subscription charges out of the Shopping
  // suggestion. "contains" (not "startsWith"/"exact") because bank
  // descriptions often prefix/suffix this, e.g. "AMAZON PRIME*ABC123CA".
  { patterns: [contains("amazon prime")], categoryStems: ["subscription", "stream", "entertain"] },
  { patterns: [contains("amazon")], categoryStems: ["shopping", "amazon"] },
  { patterns: [contains("uber"), contains("lyft")], categoryStems: ["transport", "rideshare"] },
  { patterns: [contains("shell"), contains("chevron"), contains("gas station")], categoryStems: ["gas", "fuel", "transport"] },
  { patterns: [contains("coffee"), contains("starbucks")], categoryStems: ["coffee", "dining", "restaurant"] },
];

/** A user category the dictionary can resolve a merchant to. */
export interface DictionaryTarget {
  uuid: string;
  name: string;
}

export interface GlobalMatch {
  /** uuid of the user category the merchant resolves to. */
  categoryUuid: string;
  /** The clean merchant pattern that matched — promoted to a keyword on approval. */
  pattern: string;
  /** The matched pattern's mode — carried over when promoting to a user keyword. */
  mode: Keyword["mode"];
}

/**
 * Fuzzy name match: true if either string contains the other (case-insensitive).
 * Stems are kept short (e.g. "grocer") so plural/variant names all match.
 */
function nameMatchesStem(categoryName: string, stem: string): boolean {
  const name = categoryName.toLowerCase();
  const s = stem.toLowerCase();
  return name.includes(s) || s.includes(name);
}

/**
 * Find a global-dictionary suggestion for a transaction.
 *
 * Returns the matched merchant pattern plus the uuid of the first user category
 * whose name fuzzily matches one of the entry's stems, or null if the merchant
 * is unknown or the user has no matching-named category.
 */
export function matchGlobalDictionary(
  matchField: string,
  userCategories: DictionaryTarget[]
): GlobalMatch | null {
  for (const entry of GLOBAL_DICTIONARY) {
    const matchedPattern = entry.patterns.find((p) => matchesKeyword(matchField, p));
    if (!matchedPattern) continue;

    const target = userCategories.find((cat) =>
      entry.categoryStems.some((stem) => nameMatchesStem(cat.name, stem))
    );
    if (target) {
      return { categoryUuid: target.uuid, pattern: matchedPattern.text, mode: matchedPattern.mode };
    }
    // Merchant known but no matching-named category — keep scanning in case
    // another entry also matches and does resolve.
  }

  return null;
}
