/**
 * budget_hierarchy_v1 — core data migration (dependency-injected DB).
 *
 * Converts the flat category system to the 3-level budget hierarchy. Kept free
 * of ./connection so it can be exercised against a scratch database in tests.
 *
 * For each user: existing non-system categories become budget items under an
 * "Ungrouped" group (uuid reused so in-flight import drafts still resolve);
 * transactions are re-linked; monthly budget rows are copied (deduped, latest
 * write wins); yearly rows are dropped; and the default hierarchy structure is
 * seeded (structure + keywords only, no amounts). Finally drops budgets_legacy.
 */

import type BetterSqlite3 from "better-sqlite3";
import { randomUUID } from "crypto";
import { DEFAULT_BUDGET_HIERARCHY } from "./budget-hierarchy-data";

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

export function migrateBudgetHierarchy(sqlite: DB): void {
  const now = Date.now();

  // Prepared statements ------------------------------------------------------
  const insertGroup = sqlite.prepare(
    "INSERT INTO budget_groups (uuid, name, `order`, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insertSub = sqlite.prepare(
    "INSERT INTO budget_subcategories (uuid, name, group_id, `order`, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  // Inserts into budget_items_legacy: on a from-scratch install, the SQL
  // migration for budget_hierarchy_v2 has already renamed budget_items to
  // budget_items_legacy before any TS data migration runs, and the v2 TS
  // migration (which runs immediately after this one) folds these rows into
  // budget_subcategories the same way it does for real historical data.
  const insertItem = sqlite.prepare(
    "INSERT INTO budget_items_legacy (uuid, name, subcategory_id, keywords, item_type, target_amount, is_active, `order`, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)"
  );
  const insertBudget = sqlite.prepare(
    "INSERT INTO budgets (budget_item_id, year, month, amount, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const relinkTx = sqlite.prepare(
    "UPDATE transactions SET budget_item_id = ?, category_id = NULL WHERE category_id = ? AND user_id = ?"
  );
  const hasGroups = sqlite.prepare("SELECT 1 FROM budget_groups WHERE user_id = ? LIMIT 1");
  const nonSystemCats = sqlite.prepare(
    "SELECT id, uuid, name, keywords, `order` FROM categories WHERE user_id = ? AND (is_system IS NULL OR is_system = 0) ORDER BY `order`"
  );
  const legacyMonthly = sqlite.prepare(
    "SELECT category_id, year, month, amount, updated_at FROM budgets_legacy WHERE user_id = ? AND month IS NOT NULL ORDER BY updated_at ASC"
  );
  const legacyYearlyCount = sqlite.prepare(
    "SELECT COUNT(*) AS c FROM budgets_legacy WHERE user_id = ? AND month IS NULL"
  );
  const deleteNonSystemCats = sqlite.prepare(
    "DELETE FROM categories WHERE user_id = ? AND (is_system IS NULL OR is_system = 0)"
  );

  // Insert the default hierarchy (structure + keywords only, no amounts).
  function seedDefaultStructure(userId: number, startOrder: number): void {
    let groupOrder = startOrder;
    for (const group of DEFAULT_BUDGET_HIERARCHY) {
      const groupId = insertGroup.run(randomUUID(), group.name, groupOrder++, userId, now, now)
        .lastInsertRowid as number;
      let subOrder = 0;
      for (const sub of group.subcategories) {
        const subId = insertSub.run(randomUUID(), sub.name, groupId, subOrder++, userId, now, now)
          .lastInsertRowid as number;
        let itemOrder = 0;
        for (const item of sub.items) {
          insertItem.run(
            randomUUID(),
            item.name,
            subId,
            JSON.stringify(item.keywords),
            item.itemType ?? "expense",
            item.targetAmount ?? null,
            itemOrder++,
            userId,
            now,
            now
          );
        }
      }
    }
  }

  const users = sqlite.prepare("SELECT id FROM users").all() as { id: number }[];

  const migrateUser = sqlite.transaction((userId: number) => {
    // Skip users who already have a hierarchy (idempotent belt-and-suspenders).
    if (hasGroups.get(userId)) return;

    // 1. Ungrouped group + subcategory ------------------------------------
    const ungroupedGroupId = insertGroup.run(randomUUID(), "Ungrouped", 0, userId, now, now)
      .lastInsertRowid as number;
    const ungroupedSubId = insertSub.run(randomUUID(), "Ungrouped", ungroupedGroupId, 0, userId, now, now)
      .lastInsertRowid as number;

    // 2. Each non-system category → budget item (uuid reused) -------------
    const cats = nonSystemCats.all(userId) as {
      id: number;
      uuid: string;
      name: string;
      keywords: string;
      order: number;
    }[];
    const catToItem = new Map<number, number>();
    for (const cat of cats) {
      const itemId = insertItem.run(
        cat.uuid, // reuse category uuid so in-flight import drafts keep resolving
        cat.name,
        ungroupedSubId,
        cat.keywords ?? "[]",
        "expense",
        null,
        cat.order ?? 0,
        userId,
        now,
        now
      ).lastInsertRowid as number;
      catToItem.set(cat.id, itemId);
    }

    // 3. Re-link transactions ---------------------------------------------
    for (const [catId, itemId] of catToItem) {
      relinkTx.run(itemId, catId, userId);
    }

    // 4. Copy monthly budget rows (dedupe by (categoryId,year,month), keep
    //    latest updatedAt — legacyMonthly is ordered ASC so last write wins).
    const monthly = legacyMonthly.all(userId) as {
      category_id: number;
      year: number;
      month: number;
      amount: number;
      updated_at: number;
    }[];
    const deduped = new Map<string, { itemId: number; year: number; month: number; amount: number }>();
    for (const row of monthly) {
      const itemId = catToItem.get(row.category_id);
      if (itemId === undefined) continue; // budget referenced a system/foreign category
      deduped.set(`${row.category_id}:${row.year}:${row.month}`, {
        itemId,
        year: row.year,
        month: row.month,
        amount: row.amount,
      });
    }
    for (const b of deduped.values()) {
      insertBudget.run(b.itemId, b.year, b.month, b.amount, userId, now, now);
    }

    // 5. Log dropped yearly rows ------------------------------------------
    const yearlyCount = (legacyYearlyCount.get(userId) as { c: number }).c;
    if (yearlyCount > 0) {
      logMigration(
        sqlite,
        "info",
        `Dropped ${yearlyCount} legacy yearly budget row(s) during hierarchy migration`,
        { yearlyRowsDropped: yearlyCount },
        userId
      );
    }

    // 6. Delete migrated categories (cascades their budgets_legacy rows) ---
    deleteNonSystemCats.run(userId);

    // 7. Seed the default hierarchy structure (no amounts) ----------------
    //    Ordered after Ungrouped (which is order 0), so start at 1.
    seedDefaultStructure(userId, 1);
  });

  for (const user of users) {
    migrateUser(user.id);
  }

  // Clean up legacy null-user (global) non-system categories -----------------
  const nullUserCatCount = (
    sqlite
      .prepare(
        "SELECT COUNT(*) AS c FROM categories WHERE user_id IS NULL AND (is_system IS NULL OR is_system = 0)"
      )
      .get() as { c: number }
  ).c;
  if (nullUserCatCount > 0) {
    sqlite
      .prepare("DELETE FROM categories WHERE user_id IS NULL AND (is_system IS NULL OR is_system = 0)")
      .run();
    logMigration(
      sqlite,
      "info",
      `Deleted ${nullUserCatCount} legacy null-user category row(s) during hierarchy migration`,
      { nullUserCategoriesDeleted: nullUserCatCount },
      null
    );
  }

  // Drop the legacy budgets table now that all mappings are done -------------
  sqlite.exec("DROP TABLE IF EXISTS budgets_legacy");
}
