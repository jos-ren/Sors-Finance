import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { randomUUID } from "crypto";
import { eq, and, ne } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { seedDefaultCategoriesForUser } from "@/lib/db/seed";
import { normalizeAssignment } from "@/lib/budget/normalize-assignment";

// GET /api/data - Export all data for the authenticated user (v4.0 hierarchy:
// Category Group → Category, i.e. budgetSubcategories is the leaf).
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const [
      transactions,
      categories,
      budgetGroups,
      budgetSubcategories,
      budgets,
      imports,
      portfolioItems,
      portfolioAccounts,
      portfolioSnapshots,
      settings,
      customImportTemplates,
    ] = await Promise.all([
      db.select().from(schema.transactions).where(eq(schema.transactions.userId, userId)),
      db.select().from(schema.categories).where(eq(schema.categories.userId, userId)),
      db.select().from(schema.budgetGroups).where(eq(schema.budgetGroups.userId, userId)),
      db.select().from(schema.budgetSubcategories).where(eq(schema.budgetSubcategories.userId, userId)),
      db.select().from(schema.budgets).where(eq(schema.budgets.userId, userId)),
      db.select().from(schema.imports).where(eq(schema.imports.userId, userId)),
      db.select().from(schema.portfolioItems).where(eq(schema.portfolioItems.userId, userId)),
      db.select().from(schema.portfolioAccounts).where(eq(schema.portfolioAccounts.userId, userId)),
      db.select().from(schema.portfolioSnapshots).where(eq(schema.portfolioSnapshots.userId, userId)),
      db.select().from(schema.settings).where(eq(schema.settings.userId, userId)),
      db.select().from(schema.customImportTemplates).where(eq(schema.customImportTemplates.userId, userId)),
    ]);

    return NextResponse.json({
      data: {
        transactions,
        categories,
        budgetGroups,
        budgetSubcategories,
        budgets,
        imports,
        portfolioItems,
        portfolioAccounts,
        portfolioSnapshots,
        settings,
        customImportTemplates,
        exportedAt: new Date().toISOString(),
        version: "4.0", // 2-level budget hierarchy (Category Group → Category)
      },
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/data error:", error);
    return NextResponse.json({ error: "Failed to export data", success: false }, { status: 500 });
  }
}

/** Clear a user's budget + transaction data in FK-safe order. */
async function clearUserBudgetData(userId: number) {
  await db.delete(schema.budgets).where(eq(schema.budgets.userId, userId));
  await db.delete(schema.transactions).where(eq(schema.transactions.userId, userId));
  await db.delete(schema.budgetSubcategories).where(eq(schema.budgetSubcategories.userId, userId));
  await db.delete(schema.budgetGroups).where(eq(schema.budgetGroups.userId, userId));
}

// DELETE /api/data - Clear all data for the authenticated user
// keepCategories=true keeps categories/settings (for demo data generation)
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const keepCategories = request.nextUrl.searchParams.get("keepCategories") === "true";

    await db.delete(schema.portfolioSnapshots).where(eq(schema.portfolioSnapshots.userId, userId));
    await db.delete(schema.portfolioItems).where(eq(schema.portfolioItems.userId, userId));
    await db.delete(schema.portfolioAccounts).where(eq(schema.portfolioAccounts.userId, userId));
    await clearUserBudgetData(userId);
    await db.delete(schema.imports).where(eq(schema.imports.userId, userId));

    if (!keepCategories) {
      await db.delete(schema.categories).where(and(eq(schema.categories.userId, userId), ne(schema.categories.isSystem, true)));
      await db.delete(schema.settings).where(eq(schema.settings.userId, userId));
      await db.delete(schema.customImportTemplates).where(eq(schema.customImportTemplates.userId, userId));
    }

    return NextResponse.json({ data: { cleared: true, keptCategories: keepCategories }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("DELETE /api/data error:", error);
    return NextResponse.json({ error: "Failed to clear data", success: false }, { status: 500 });
  }
}

// POST /api/data - Import data (restore from backup) for the authenticated user.
// Supports v4.0 (2-level Category Group → Category), v3.0 (3-level, items
// merged into their subcategory on import — same policy as the
// budget_hierarchy_v2 data migration), and legacy v2.0 (flat categories,
// converted into an Ungrouped category).
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const body = await request.json();
    const now = new Date();

    // Clear existing data (FK-safe order): budgets → transactions → categories → groups.
    await db.delete(schema.portfolioSnapshots).where(eq(schema.portfolioSnapshots.userId, userId));
    await db.delete(schema.portfolioItems).where(eq(schema.portfolioItems.userId, userId));
    await db.delete(schema.portfolioAccounts).where(eq(schema.portfolioAccounts.userId, userId));
    await clearUserBudgetData(userId);
    await db.delete(schema.imports).where(eq(schema.imports.userId, userId));
    await db.delete(schema.customImportTemplates).where(eq(schema.customImportTemplates.userId, userId));
    await db.delete(schema.categories).where(and(eq(schema.categories.userId, userId), ne(schema.categories.isSystem, true)));
    await db.delete(schema.settings).where(eq(schema.settings.userId, userId));

    // Ensure system categories exist and map exported category ids → system ids by name.
    await seedDefaultCategoriesForUser(userId);
    const systemCategories = await db
      .select()
      .from(schema.categories)
      .where(and(eq(schema.categories.userId, userId), eq(schema.categories.isSystem, true)));

    // Maps from exported ids to newly-created ids.
    const categoryIdMap = new Map<number, number>(); // exported category id → system category id
    const itemIdMap = new Map<number, number>(); // exported item/category id → new budget category (subcategory row) id

    const hasBudgetGroups = Array.isArray(body.budgetGroups);
    const hasLegacyItems = Array.isArray(body.budgetItems); // v3.0 shape

    if (hasBudgetGroups) {
      // ---- v3.0/v4.0: import the hierarchy directly ----------------------
      const groupIdMap = new Map<number, number>();
      for (const g of body.budgetGroups ?? []) {
        const res = await db
          .insert(schema.budgetGroups)
          .values({ uuid: randomUUID(), name: g.name, order: g.order ?? 0, userId, createdAt: g.createdAt ? new Date(g.createdAt) : now, updatedAt: now })
          .returning({ id: schema.budgetGroups.id });
        if (g.id && res[0]) groupIdMap.set(g.id, res[0].id);
      }
      const subIdMap = new Map<number, number>();
      for (const s of body.budgetSubcategories ?? []) {
        const groupId = s.groupId ? groupIdMap.get(s.groupId) : undefined;
        if (!groupId) continue;
        const res = await db
          .insert(schema.budgetSubcategories)
          .values({
            uuid: randomUUID(),
            name: s.name,
            groupId,
            keywords: s.keywords ?? [], // present on v4.0 exports; empty for v3.0 (folded in below)
            itemType: s.itemType === "goal" ? "goal" : "expense",
            targetAmount: s.targetAmount ?? null,
            isActive: s.isActive ?? true,
            order: s.order ?? 0,
            userId,
            createdAt: s.createdAt ? new Date(s.createdAt) : now,
            updatedAt: now,
          })
          .returning({ id: schema.budgetSubcategories.id });
        if (s.id && res[0]) subIdMap.set(s.id, res[0].id);
      }

      if (hasLegacyItems) {
        // v3.0: fold each subcategory's items into it (union keywords, a goal
        // item's type/target wins, active if any item was active), then point
        // transactions/budgets at the subcategory instead of the old item.
        const itemsBySub = new Map<number, Array<{ id: number; keywords?: string[]; itemType?: string; targetAmount?: number | null; isActive?: boolean }>>();
        for (const it of body.budgetItems ?? []) {
          if (!it.subcategoryId) continue;
          if (!itemsBySub.has(it.subcategoryId)) itemsBySub.set(it.subcategoryId, []);
          itemsBySub.get(it.subcategoryId)!.push(it);
          const newSubId = subIdMap.get(it.subcategoryId);
          if (it.id && newSubId) itemIdMap.set(it.id, newSubId);
        }
        for (const [oldSubId, items] of itemsBySub) {
          const newSubId = subIdMap.get(oldSubId);
          if (!newSubId) continue;
          const keywords = Array.from(new Set(items.flatMap((it) => it.keywords ?? [])));
          const goal = items.find((it) => it.itemType === "goal");
          await db
            .update(schema.budgetSubcategories)
            .set({
              keywords,
              itemType: goal ? "goal" : "expense",
              targetAmount: goal?.targetAmount ?? null,
              isActive: items.some((it) => it.isActive !== false),
              updatedAt: now,
            })
            .where(and(eq(schema.budgetSubcategories.id, newSubId), eq(schema.budgetSubcategories.userId, userId)));
        }
      } else {
        // v4.0: the subcategory row already is the category transactions link to.
        for (const s of body.budgetSubcategories ?? []) {
          const newSubId = subIdMap.get(s.id);
          if (s.id && newSubId) itemIdMap.set(s.id, newSubId);
        }
      }

      // Map exported system categories → existing system categories by name.
      for (const cat of body.categories ?? []) {
        if (cat.isSystem && cat.id) {
          const sys = systemCategories.find((c) => c.name === cat.name);
          if (sys) categoryIdMap.set(cat.id, sys.id);
        }
      }
    } else {
      // ---- legacy v2.0: convert flat categories to an Ungrouped category
      const groupRes = await db
        .insert(schema.budgetGroups)
        .values({ uuid: randomUUID(), name: "Ungrouped", order: 0, userId, createdAt: now, updatedAt: now })
        .returning({ id: schema.budgetGroups.id });

      let order = 0;
      for (const cat of body.categories ?? []) {
        if (cat.isSystem) {
          const sys = systemCategories.find((c) => c.name === cat.name);
          if (sys && cat.id) categoryIdMap.set(cat.id, sys.id);
          continue;
        }
        const res = await db
          .insert(schema.budgetSubcategories)
          .values({
            uuid: randomUUID(),
            name: cat.name,
            groupId: groupRes[0].id,
            keywords: cat.keywords ?? [],
            itemType: "expense",
            targetAmount: null,
            isActive: true,
            order: order++,
            userId,
            createdAt: cat.createdAt ? new Date(cat.createdAt) : now,
            updatedAt: now,
          })
          .returning({ id: schema.budgetSubcategories.id });
        if (cat.id && res[0]) itemIdMap.set(cat.id, res[0].id);
      }
    }

    // Import imports
    const importIdMap = new Map<number, number>();
    for (const imp of body.imports ?? []) {
      const res = await db
        .insert(schema.imports)
        .values({
          fileName: imp.fileName,
          source: imp.source,
          transactionCount: imp.transactionCount ?? 0,
          totalAmount: imp.totalAmount ?? 0,
          userId,
          importedAt: imp.importedAt ? new Date(imp.importedAt) : now,
        })
        .returning({ id: schema.imports.id });
      if (imp.id && res[0]) importIdMap.set(imp.id, res[0].id);
    }

    // Import transactions — resolve one FK from either the category map or the
    // (system) category map, honouring the one-FK rule.
    for (const t of body.transactions ?? []) {
      const mappedItem = t.budgetItemId ? itemIdMap.get(t.budgetItemId) : undefined;
      // Legacy v2.0 exports carry categoryId that may map to a converted category.
      const legacyItem = !hasBudgetGroups && t.categoryId ? itemIdMap.get(t.categoryId) : undefined;
      const mappedCategory = t.categoryId ? categoryIdMap.get(t.categoryId) : undefined;
      const { categoryId, budgetItemId } = normalizeAssignment({
        budgetItemId: mappedItem ?? legacyItem ?? null,
        categoryId: mappedCategory ?? null,
      });

      await db.insert(schema.transactions).values({
        uuid: randomUUID(),
        date: new Date(t.date),
        description: t.description,
        matchField: t.matchField || t.description,
        amountOut: t.amountOut ?? 0,
        amountIn: t.amountIn ?? 0,
        netAmount: t.netAmount ?? (t.amountIn - t.amountOut),
        source: t.source || "Manual",
        sourceMethod: t.sourceMethod || null,
        sourceAccountName: t.sourceAccountName || null,
        categoryId,
        budgetItemId,
        categoryLocked: t.categoryLocked ?? false,
        importId: t.importId ? (importIdMap.get(t.importId) ?? null) : null,
        userId,
        createdAt: t.createdAt ? new Date(t.createdAt) : now,
        updatedAt: t.updatedAt ? new Date(t.updatedAt) : now,
      });
    }

    // Import budgets — map to category id (hierarchy exports via budgetItemId,
    // legacy v2.0 via categoryId). Legacy yearly rows (month null) are dropped.
    for (const b of body.budgets ?? []) {
      const itemId = hasBudgetGroups
        ? (b.budgetItemId ? itemIdMap.get(b.budgetItemId) : undefined)
        : (b.categoryId ? itemIdMap.get(b.categoryId) : undefined);
      if (!itemId) continue;
      if (b.month === null || b.month === undefined) continue;
      await db.insert(schema.budgets).values({
        budgetItemId: itemId,
        year: b.year,
        month: b.month,
        amount: b.amount,
        userId,
        createdAt: b.createdAt ? new Date(b.createdAt) : now,
        updatedAt: b.updatedAt ? new Date(b.updatedAt) : now,
      });
    }

    // Import settings
    for (const s of body.settings ?? []) {
      if (s.key) {
        await db.insert(schema.settings).values({ key: s.key, value: String(s.value ?? ""), userId });
      }
    }

    // Import portfolio accounts
    const accountIdMap = new Map<number, number>();
    for (const acc of body.portfolioAccounts ?? []) {
      const res = await db
        .insert(schema.portfolioAccounts)
        .values({ uuid: randomUUID(), bucket: acc.bucket, name: acc.name, order: acc.order ?? 0, userId, createdAt: acc.createdAt ? new Date(acc.createdAt) : now, updatedAt: acc.updatedAt ? new Date(acc.updatedAt) : now })
        .returning({ id: schema.portfolioAccounts.id });
      if (acc.id && res[0]) accountIdMap.set(acc.id, res[0].id);
    }

    // Import portfolio items
    for (const item of body.portfolioItems ?? []) {
      const newAccountId = item.accountId ? accountIdMap.get(item.accountId) : null;
      if (!newAccountId) continue;
      await db.insert(schema.portfolioItems).values({
        uuid: randomUUID(),
        accountId: newAccountId,
        name: item.name,
        currentValue: item.currentValue ?? 0,
        notes: item.notes || null,
        order: item.order ?? 0,
        isActive: item.isActive ?? true,
        ticker: item.ticker || null,
        quantity: item.quantity || null,
        pricePerUnit: item.pricePerUnit || null,
        currency: item.currency || null,
        lastPriceUpdate: item.lastPriceUpdate ? new Date(item.lastPriceUpdate) : null,
        priceMode: item.priceMode || null,
        tickerType: item.tickerType || null,
        type: item.type || item.tickerType || (item.plaidAccountId ? "bank" : "other"),
        isInternational: item.isInternational || null,
        userId,
        createdAt: item.createdAt ? new Date(item.createdAt) : now,
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : now,
      });
    }

    // Import portfolio snapshots
    for (const snap of body.portfolioSnapshots ?? []) {
      await db.insert(schema.portfolioSnapshots).values({
        uuid: randomUUID(),
        date: new Date(snap.date),
        totalSavings: snap.totalSavings ?? 0,
        totalInvestments: snap.totalInvestments ?? 0,
        totalAssets: snap.totalAssets ?? 0,
        totalDebt: snap.totalDebt ?? 0,
        netWorth: snap.netWorth ?? 0,
        details: snap.details || { accounts: [], items: [] },
        userId,
        createdAt: snap.createdAt ? new Date(snap.createdAt) : now,
      });
    }

    // Import custom import templates
    for (const tpl of body.customImportTemplates ?? []) {
      await db.insert(schema.customImportTemplates).values({
        uuid: randomUUID(),
        name: tpl.name,
        mapping: tpl.mapping,
        userId,
        createdAt: tpl.createdAt ? new Date(tpl.createdAt) : now,
        updatedAt: tpl.updatedAt ? new Date(tpl.updatedAt) : now,
      });
    }

    return NextResponse.json({
      data: {
        imported: {
          budgetGroups: body.budgetGroups?.length || 0,
          budgetSubcategories: body.budgetSubcategories?.length || 0,
          budgetItems: body.budgetItems?.length || 0,
          categories: body.categories?.length || 0,
          transactions: body.transactions?.length || 0,
          budgets: body.budgets?.length || 0,
          imports: body.imports?.length || 0,
          portfolioAccounts: body.portfolioAccounts?.length || 0,
          portfolioItems: body.portfolioItems?.length || 0,
          portfolioSnapshots: body.portfolioSnapshots?.length || 0,
          settings: body.settings?.length || 0,
          customImportTemplates: body.customImportTemplates?.length || 0,
        },
      },
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("POST /api/data error:", error);
    return NextResponse.json({ error: `Failed to import data: ${(error as Error).message}`, success: false }, { status: 500 });
  }
}
