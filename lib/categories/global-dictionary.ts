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
 *   - `patterns` are matched (case-insensitive substring) against a transaction's
 *     matchField, exactly like user keywords.
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
 * a real keyword on that category — so it stops being a suggestion and starts
 * auto-clearing on future imports.
 */

export interface GlobalEntry {
  /** Substrings matched (case-insensitive) against a transaction's matchField. */
  patterns: string[];
  /** Lowercase category-name stems fuzzy-matched against the user's category names. */
  categoryStems: string[];
}

export const GLOBAL_DICTIONARY: GlobalEntry[] = [
  { patterns: ["trader joes", "whole foods", "grocery"], categoryStems: ["grocer"] },
  { patterns: ["netflix"], categoryStems: ["subscription", "stream", "entertain"] },
  { patterns: ["amazon"], categoryStems: ["shopping", "amazon"] },
  { patterns: ["uber", "lyft"], categoryStems: ["transport", "rideshare"] },
  { patterns: ["shell", "chevron", "gas station"], categoryStems: ["gas", "fuel", "transport"] },
  { patterns: ["coffee", "starbucks"], categoryStems: ["coffee", "dining", "restaurant"] },
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
  const text = matchField.toLowerCase();

  for (const entry of GLOBAL_DICTIONARY) {
    const matchedPattern = entry.patterns.find((p) => text.includes(p.toLowerCase()));
    if (!matchedPattern) continue;

    const target = userCategories.find((cat) =>
      entry.categoryStems.some((stem) => nameMatchesStem(cat.name, stem))
    );
    if (target) {
      return { categoryUuid: target.uuid, pattern: matchedPattern };
    }
    // Merchant known but no matching-named category — keep scanning in case
    // another entry also matches and does resolve.
  }

  return null;
}
