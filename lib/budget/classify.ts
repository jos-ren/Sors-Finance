/**
 * Budget money classes for Home: every category is exactly one of
 *
 *   - "bill"     fixed monthly bill (isRecurring): tracked as paid, never paced
 *   - "saving"   goal category: money moved, treated as a transfer, not spending
 *   - "spending" everything else: drives "left to spend" and the pace line
 *
 * This is the single seam for the planned goals refactor (see
 * docs/plans/home-dashboard-plan.md). Queries and components must call
 * classifyCategory() rather than reading itemType / isRecurring directly, so a
 * change to what counts as saving lands here only.
 */

import type { BudgetItemType } from "@/lib/db/types";

export type MoneyClass = "bill" | "saving" | "spending";

export function classifyCategory(cat: { itemType: BudgetItemType | string; isRecurring?: boolean | null }): MoneyClass {
  if (cat.itemType === "goal") return "saving";
  if (cat.isRecurring) return "bill";
  return "spending";
}
