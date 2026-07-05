/**
 * Overlay pending planned-amount edits (Map<itemId, string>) onto a BudgetTree
 * and recompute all rollups + the zero-based summary. Pure, so the budget page
 * can recompute live from pending values in a useMemo.
 */

import type { BudgetTree, BudgetTreeSummary } from "./types";

export function parsePending(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (value.trim() === "") return 0;
  const n = parseFloat(value);
  return isNaN(n) ? fallback : n;
}

export function computeEffectiveTree(tree: BudgetTree, pending: Map<number, string>): BudgetTree {
  let totalBudgeted = 0;
  let totalActual = 0;

  const groups = tree.groups.map((g) => {
    const subcategories = g.subcategories.map((s) => {
      const items = s.items.map((it) => {
        const planned = parsePending(pending.get(it.id), it.planned);
        totalBudgeted += planned;
        totalActual += it.actual;
        return { ...it, planned };
      });
      return {
        ...s,
        items,
        planned: items.reduce((a, i) => a + i.planned, 0),
        actual: items.reduce((a, i) => a + i.actual, 0),
      };
    });
    return {
      ...g,
      subcategories,
      planned: subcategories.reduce((a, s) => a + s.planned, 0),
      actual: subcategories.reduce((a, s) => a + s.actual, 0),
    };
  });

  const summary: BudgetTreeSummary = {
    incomeActual: tree.summary.incomeActual,
    totalBudgeted,
    totalActual,
    availableToAssign: tree.summary.incomeActual - totalBudgeted,
  };

  return { ...tree, groups, summary };
}
