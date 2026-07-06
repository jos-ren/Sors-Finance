/**
 * budget_hierarchy_v2_collapse_items — core data migration (dependency-injected DB).
 *
 * Collapses the Item layer into Subcategory, so the hierarchy goes from
 * Group → Subcategory → Item down to Group → Subcategory ("Category" in the
 * UI). `budget_items_legacy` is the pre-migration `budget_items` table,
 * renamed (not dropped) by the SQL migration so this can still read it.
 *
 * For each subcategory with items: keywords are unioned (case-insensitive
 * dedupe), item_type/target_amount are taken from a goal item if present
 * (goals never shared a subcategory with another item in production data —
 * logged as a warning if that assumption is ever violated), is_active is true
 * if any item was active, transactions are re-linked from item id to
 * subcategory id, and monthly budget rows are summed per (subcategory, year,
 * month). Finally drops budget_items_legacy.
 */

import type BetterSqlite3 from "better-sqlite3";

type DB = BetterSqlite3.Database;

function logMigration(
  sqlite: DB,
  level: "info" | "warning" | "error",
  message: string,
  details: Record<string, unknown>,
  userId: number | null
): void {
  sqlite
    .prepare(
      "INSERT INTO system_logs (level, source, message, details, user_id, created_at) VALUES (?, 'migration', ?, ?, ?, ?)"
    )
    .run(level, message, JSON.stringify(details), userId, Date.now());
}

interface LegacyItem {
  id: number;
  keywords: string;
  item_type: string;
  target_amount: number | null;
  is_active: number;
}

interface LegacyBudget {
  id: number;
  year: number;
  month: number;
  amount: number;
  user_id: number | null;
}

export function migrateCollapseBudgetItems(sqlite: DB): void {
  const now = Date.now();

  const subcategories = sqlite
    .prepare("SELECT id, user_id FROM budget_subcategories")
    .all() as { id: number; user_id: number }[];

  const itemsForSub = sqlite.prepare(
    "SELECT id, keywords, item_type, target_amount, is_active FROM budget_items_legacy WHERE subcategory_id = ? ORDER BY `order` ASC"
  );
  const updateSub = sqlite.prepare(
    "UPDATE budget_subcategories SET keywords = ?, item_type = ?, target_amount = ?, is_active = ?, updated_at = ? WHERE id = ?"
  );
  const relinkTx = sqlite.prepare("UPDATE transactions SET budget_item_id = ? WHERE budget_item_id = ?");
  const budgetsForItem = sqlite.prepare(
    "SELECT id, year, month, amount, user_id FROM budgets WHERE budget_item_id = ?"
  );
  const deleteBudget = sqlite.prepare("DELETE FROM budgets WHERE id = ?");
  const insertBudget = sqlite.prepare(
    "INSERT INTO budgets (budget_item_id, year, month, amount, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  const migrate = sqlite.transaction(() => {
    for (const sub of subcategories) {
      const items = itemsForSub.all(sub.id) as LegacyItem[];
      if (items.length === 0) continue; // nothing to fold in; leave column defaults

      // Merge keywords (case-insensitive dedupe, first-seen casing wins).
      const dedupedKeywords: string[] = [];
      const lowerSeen = new Set<string>();
      for (const it of items) {
        const kws: string[] = JSON.parse(it.keywords || "[]");
        for (const k of kws) {
          const lower = k.toLowerCase();
          if (!lowerSeen.has(lower)) {
            lowerSeen.add(lower);
            dedupedKeywords.push(k);
          }
        }
      }

      // Merge type/target: a goal item wins. Log if the "goals are always
      // alone in their subcategory" assumption (validated against prod data
      // pre-migration) doesn't hold, since summing goal targets would be a
      // silent judgment call otherwise.
      const goalItems = items.filter((it) => it.item_type === "goal");
      const distinctTypes = new Set(items.map((it) => it.item_type));
      if (goalItems.length > 1 || distinctTypes.size > 1) {
        logMigration(
          sqlite,
          "warning",
          `Subcategory ${sub.id} had ${goalItems.length} goal item(s) and ${distinctTypes.size} distinct item type(s) while collapsing items into it; used the first goal item's type/target`,
          { subcategoryId: sub.id, itemCount: items.length, goalCount: goalItems.length },
          sub.user_id
        );
      }
      const itemType = goalItems.length > 0 ? "goal" : "expense";
      const targetAmount = goalItems.length > 0 ? goalItems[0].target_amount : null;
      const isActive = items.some((it) => it.is_active) ? 1 : 0;

      updateSub.run(dedupedKeywords.length ? JSON.stringify(dedupedKeywords) : "[]", itemType, targetAmount, isActive, now, sub.id);

      // Re-link transactions from item id to subcategory id.
      for (const it of items) {
        relinkTx.run(sub.id, it.id);
      }

      // Merge monthly budget rows: sum amounts per (year, month) across items,
      // replace with a single row keyed to the subcategory.
      const byMonth = new Map<string, { year: number; month: number; amount: number; userId: number | null }>();
      const oldBudgetIds: number[] = [];
      for (const it of items) {
        const rows = budgetsForItem.all(it.id) as LegacyBudget[];
        for (const r of rows) {
          oldBudgetIds.push(r.id);
          const key = `${r.year}:${r.month}`;
          const existing = byMonth.get(key);
          if (existing) {
            existing.amount += r.amount;
          } else {
            byMonth.set(key, { year: r.year, month: r.month, amount: r.amount, userId: r.user_id });
          }
        }
      }
      for (const id of oldBudgetIds) deleteBudget.run(id);
      for (const b of byMonth.values()) {
        insertBudget.run(sub.id, b.year, b.month, b.amount, b.userId, now, now);
      }
    }
  });

  migrate();

  sqlite.exec("DROP TABLE IF EXISTS budget_items_legacy");
}
