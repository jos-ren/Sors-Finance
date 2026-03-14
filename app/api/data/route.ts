import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { randomUUID } from "crypto";
import { eq, and, ne } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { seedDefaultCategoriesForUser } from "@/lib/db/seed";

// GET /api/data - Export all data for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const [
      transactions,
      categories,
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
        budgets,
        imports,
        portfolioItems,
        portfolioAccounts,
        portfolioSnapshots,
        settings,
        customImportTemplates,
        exportedAt: new Date().toISOString(),
        version: "2.0", // SQLite version
      },
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/data error:", error);
    return NextResponse.json(
      { error: "Failed to export data", success: false },
      { status: 500 }
    );
  }
}

// DELETE /api/data - Clear all data for the authenticated user
// Query params:
// - keepCategories=true: Keep categories and settings (for demo data generation)
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const keepCategories = request.nextUrl.searchParams.get("keepCategories") === "true";

    // Delete in reverse order of dependencies - only for this user
    await db.delete(schema.portfolioSnapshots).where(eq(schema.portfolioSnapshots.userId, userId));
    await db.delete(schema.portfolioItems).where(eq(schema.portfolioItems.userId, userId));
    await db.delete(schema.portfolioAccounts).where(eq(schema.portfolioAccounts.userId, userId));
    await db.delete(schema.budgets).where(eq(schema.budgets.userId, userId));
    await db.delete(schema.transactions).where(eq(schema.transactions.userId, userId));
    await db.delete(schema.imports).where(eq(schema.imports.userId, userId));

    if (!keepCategories) {
      // Only delete non-system categories - preserve system categories (Uncategorized, Excluded, Income)
      await db.delete(schema.categories).where(
        and(
          eq(schema.categories.userId, userId),
          ne(schema.categories.isSystem, true)
        )
      );
      await db.delete(schema.settings).where(eq(schema.settings.userId, userId));
      await db.delete(schema.customImportTemplates).where(eq(schema.customImportTemplates.userId, userId));
    }

    return NextResponse.json({
      data: { cleared: true, keptCategories: keepCategories },
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("DELETE /api/data error:", error);
    return NextResponse.json(
      { error: "Failed to clear data", success: false },
      { status: 500 }
    );
  }
}

// POST /api/data - Import data (restore from backup) for the authenticated user
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const body = await request.json();
    const now = new Date();

    // Clear existing data first - only for this user
    await db.delete(schema.portfolioSnapshots).where(eq(schema.portfolioSnapshots.userId, userId));
    await db.delete(schema.portfolioItems).where(eq(schema.portfolioItems.userId, userId));
    await db.delete(schema.portfolioAccounts).where(eq(schema.portfolioAccounts.userId, userId));
    await db.delete(schema.budgets).where(eq(schema.budgets.userId, userId));
    await db.delete(schema.transactions).where(eq(schema.transactions.userId, userId));
    await db.delete(schema.imports).where(eq(schema.imports.userId, userId));
    await db.delete(schema.customImportTemplates).where(eq(schema.customImportTemplates.userId, userId));
    // Only delete non-system categories - preserve system categories
    await db.delete(schema.categories).where(
      and(
        eq(schema.categories.userId, userId),
        ne(schema.categories.isSystem, true)
      )
    );
    await db.delete(schema.settings).where(eq(schema.settings.userId, userId));

    // Get existing system categories for ID mapping
    const existingSystemCategories = await db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.userId, userId),
          eq(schema.categories.isSystem, true)
        )
      );

    // Import categories first (for foreign key references)
    const categoryIdMap = new Map<number, number>();
    if (body.categories?.length) {
      for (const cat of body.categories) {
        const oldId = cat.id;

        // For system categories, map to existing ones by name
        if (cat.isSystem) {
          const existingSysCat = existingSystemCategories.find(c => c.name === cat.name);
          if (existingSysCat && oldId) {
            categoryIdMap.set(oldId, existingSysCat.id);
          }
          continue; // Don't re-import system categories
        }

        const result = await db.insert(schema.categories).values({
          uuid: randomUUID(), // Always generate new UUID to avoid conflicts
          name: cat.name,
          keywords: cat.keywords || [],
          order: cat.order ?? 0,
          isSystem: false,
          excludeFromBudget: cat.excludeFromBudget ?? false,
          userId,
          createdAt: cat.createdAt ? new Date(cat.createdAt) : now,
          updatedAt: cat.updatedAt ? new Date(cat.updatedAt) : now,
        }).returning({ id: schema.categories.id });
        if (oldId && result[0]) {
          categoryIdMap.set(oldId, result[0].id);
        }
      }
    }

    // Ensure system categories exist (in case backup didn't have them)
    await seedDefaultCategoriesForUser(userId);

    // Import imports
    const importIdMap = new Map<number, number>();
    if (body.imports?.length) {
      for (const imp of body.imports) {
        const oldId = imp.id;
        const result = await db.insert(schema.imports).values({
          fileName: imp.fileName,
          source: imp.source,
          transactionCount: imp.transactionCount ?? 0,
          totalAmount: imp.totalAmount ?? 0,
          userId,
          importedAt: imp.importedAt ? new Date(imp.importedAt) : now,
        }).returning({ id: schema.imports.id });
        if (oldId && result[0]) {
          importIdMap.set(oldId, result[0].id);
        }
      }
    }

    // Import transactions
    if (body.transactions?.length) {
      for (const t of body.transactions) {
        await db.insert(schema.transactions).values({
          uuid: randomUUID(), // Always generate new UUID to avoid conflicts
          date: new Date(t.date),
          description: t.description,
          matchField: t.matchField || t.description,
          amountOut: t.amountOut ?? 0,
          amountIn: t.amountIn ?? 0,
          netAmount: t.netAmount ?? (t.amountIn - t.amountOut),
          source: t.source || "Manual",
          sourceMethod: t.sourceMethod || null,
          sourceAccountName: t.sourceAccountName || null,
          categoryId: t.categoryId ? (categoryIdMap.get(t.categoryId) ?? null) : null,
          importId: t.importId ? (importIdMap.get(t.importId) ?? null) : null,
          userId,
          createdAt: t.createdAt ? new Date(t.createdAt) : now,
          updatedAt: t.updatedAt ? new Date(t.updatedAt) : now,
        });
      }
    }

    // Import budgets
    if (body.budgets?.length) {
      for (const b of body.budgets) {
        const newCategoryId = b.categoryId ? categoryIdMap.get(b.categoryId) : null;
        if (newCategoryId) {
          await db.insert(schema.budgets).values({
            categoryId: newCategoryId,
            year: b.year,
            month: b.month,
            amount: b.amount,
            userId,
            createdAt: b.createdAt ? new Date(b.createdAt) : now,
            updatedAt: b.updatedAt ? new Date(b.updatedAt) : now,
          });
        }
      }
    }

    // Import settings
    if (body.settings?.length) {
      for (const s of body.settings) {
        if (s.key) {
          await db.insert(schema.settings).values({
            key: s.key,
            value: String(s.value ?? ""),
            userId,
          });
        }
      }
    }

    // Import portfolio accounts
    const accountIdMap = new Map<number, number>();
    if (body.portfolioAccounts?.length) {
      for (const acc of body.portfolioAccounts) {
        const oldId = acc.id;
        const result = await db.insert(schema.portfolioAccounts).values({
          uuid: randomUUID(), // Always generate new UUID to avoid conflicts
          bucket: acc.bucket,
          name: acc.name,
          order: acc.order ?? 0,
          userId,
          createdAt: acc.createdAt ? new Date(acc.createdAt) : now,
          updatedAt: acc.updatedAt ? new Date(acc.updatedAt) : now,
        }).returning({ id: schema.portfolioAccounts.id });
        if (oldId && result[0]) {
          accountIdMap.set(oldId, result[0].id);
        }
      }
    }

    // Import portfolio items
    if (body.portfolioItems?.length) {
      for (const item of body.portfolioItems) {
        const newAccountId = item.accountId ? accountIdMap.get(item.accountId) : null;
        if (newAccountId) {
          await db.insert(schema.portfolioItems).values({
            uuid: randomUUID(), // Always generate new UUID to avoid conflicts
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
            isInternational: item.isInternational || null,
            // plaidAccountId intentionally omitted — Plaid data is not exported
            userId,
            createdAt: item.createdAt ? new Date(item.createdAt) : now,
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : now,
          });
        }
      }
    }

    // Import portfolio snapshots
    if (body.portfolioSnapshots?.length) {
      for (const snap of body.portfolioSnapshots) {
        await db.insert(schema.portfolioSnapshots).values({
          uuid: randomUUID(), // Always generate new UUID to avoid conflicts
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
    }

    // Import custom import templates (CSV/Excel column mappings)
    if (body.customImportTemplates?.length) {
      for (const tpl of body.customImportTemplates) {
        await db.insert(schema.customImportTemplates).values({
          uuid: randomUUID(), // Always generate new UUID to avoid conflicts
          name: tpl.name,
          mapping: tpl.mapping,
          userId,
          createdAt: tpl.createdAt ? new Date(tpl.createdAt) : now,
          updatedAt: tpl.updatedAt ? new Date(tpl.updatedAt) : now,
        });
      }
    }

    return NextResponse.json({
      data: {
        imported: {
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
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/data error:", error);
    return NextResponse.json(
      { error: `Failed to import data: ${(error as Error).message}`, success: false },
      { status: 500 }
    );
  }
}
