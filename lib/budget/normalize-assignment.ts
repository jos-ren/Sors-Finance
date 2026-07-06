/**
 * One-FK assignment rule for transactions.
 *
 * A transaction is classified by AT MOST ONE of:
 *   - `budgetItemId` — a budget hierarchy leaf (normal spending/income-adjacent), or
 *   - `categoryId`   — a system category (Income / Excluded / Uncategorized).
 *
 * Both null ⇒ uncategorized. This is enforced in code (via this helper in every
 * write path) rather than a DB CHECK constraint, to avoid a SQLite rebuild of
 * the transactions table. A budget item assignment always wins over a category.
 */

export interface Assignment {
  categoryId: number | null;
  budgetItemId: number | null;
}

export function normalizeAssignment(input: {
  categoryId?: number | null;
  budgetItemId?: number | null;
}): Assignment {
  const budgetItemId = input.budgetItemId ?? null;
  const categoryId = input.categoryId ?? null;

  if (budgetItemId != null) return { categoryId: null, budgetItemId };
  if (categoryId != null) return { categoryId, budgetItemId: null };
  return { categoryId: null, budgetItemId: null };
}
