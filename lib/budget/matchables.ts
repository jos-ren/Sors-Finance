/**
 * Matchables — the set of keyword-bearing targets auto-categorization runs
 * against. In the hierarchy world these are the active budget items plus the
 * Income system category (the only system category that carries keywords).
 *
 * Each matchable satisfies the categorizer's `{ uuid, name, keywords }` shape
 * and additionally records whether it resolves to a budget item or a system
 * category, so the importer/save step can emit exactly one FK.
 */

export type MatchableKind = "item" | "system";

export interface Matchable {
  /** uuid used as the categorizer's match id (draft transactions carry this). */
  uuid: string;
  name: string;
  keywords: string[];
  kind: MatchableKind;
  /** DB row id of the underlying budget item or category. */
  refId: number;
}

interface MinimalItem {
  id: number;
  uuid: string;
  name: string;
  keywords: string[];
  isActive?: boolean;
}

interface MinimalCategory {
  id: number;
  uuid: string;
  name: string;
  keywords: string[];
}

/**
 * Build the matchable list from active budget items and (optionally) the Income
 * system category. Inactive/archived items are excluded by the caller or here
 * defensively via `isActive`.
 */
export function buildMatchables(
  activeItems: MinimalItem[],
  incomeCategory?: MinimalCategory | null
): Matchable[] {
  const matchables: Matchable[] = activeItems
    .filter((i) => i.isActive !== false)
    .map((i) => ({
      uuid: i.uuid,
      name: i.name,
      keywords: i.keywords ?? [],
      kind: "item" as const,
      refId: i.id,
    }));

  if (incomeCategory) {
    matchables.push({
      uuid: incomeCategory.uuid,
      name: incomeCategory.name,
      keywords: incomeCategory.keywords ?? [],
      kind: "system",
      refId: incomeCategory.id,
    });
  }

  return matchables;
}
