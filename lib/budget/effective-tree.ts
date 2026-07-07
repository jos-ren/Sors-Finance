/**
 * Overlay pending planned-amount edits (Map<categoryId, string>) onto a
 * BudgetTree and recompute all rollups + the zero-based summary. Pure, so the
 * budget page can recompute live from pending values in a useMemo.
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
    const categories = g.categories.map((c) => {
      const planned = parsePending(pending.get(c.id), c.planned);
      totalBudgeted += planned;
      // Goal spend draws from the goal's fund, not this month's budget —
      // mirror the tree route and keep it out of spent-vs-planned rollups.
      if (c.itemType !== "goal") totalActual += c.actual;
      return { ...c, planned };
    });
    return {
      ...g,
      categories,
      planned: categories.reduce((a, c) => a + c.planned, 0),
      actual: categories.reduce((a, c) => a + (c.itemType === "goal" ? 0 : c.actual), 0),
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
