/**
 * Budget money classes. Every category is exactly one of
 *
 *   - "bill"     fixed monthly bill (isRecurring): tracked as paid, never paced
 *   - "saving"   saving category: money set aside, treated as a transfer, not spending
 *   - "spending" everything else: drives "left to spend" and the pace line
 *
 * A transaction can also be "project": it belongs to a project that is funded
 * separately, so it leaves the monthly spending math and shows as its own
 * line (still counted against Saved). See docs/spikes/goals-to-projects.md.
 *
 * This is the single seam for these decisions. Queries and components must
 * call these helpers rather than reading itemType / isRecurring /
 * fundedSeparately directly.
 */

import type { BudgetItemType } from "@/lib/db/types";

export type MoneyClass = "bill" | "saving" | "spending";
export type TransactionClass = MoneyClass | "project";

/** Normalize an incoming item type. The legacy "goal" (pre-Projects backups and clients) becomes "saving". */
export function toItemType(raw: unknown): BudgetItemType {
  return raw === "saving" || raw === "goal" ? "saving" : "expense";
}

export function classifyCategory(cat: { itemType: BudgetItemType | string; isRecurring?: boolean | null }): MoneyClass {
  if (toItemType(cat.itemType) === "saving") return "saving";
  if (cat.isRecurring) return "bill";
  return "spending";
}

/** True when a project's transactions leave the monthly spending math. */
export function isSeparateProject(project: { fundedSeparately: boolean } | null | undefined): boolean {
  return !!project?.fundedSeparately;
}

/**
 * Class of a transaction that is not Excluded. A separately funded project
 * wins over the category; otherwise the category decides. Returns null for
 * rows without a budget category (Income or Uncategorized), which callers
 * handle themselves.
 */
export function classifyTransaction(
  category: { itemType: BudgetItemType | string; isRecurring?: boolean | null } | null | undefined,
  project: { fundedSeparately: boolean } | null | undefined
): TransactionClass | null {
  if (isSeparateProject(project)) return "project";
  return category ? classifyCategory(category) : null;
}
