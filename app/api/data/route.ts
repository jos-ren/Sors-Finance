import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { randomUUID } from "crypto";

// GET /api/data - Export all data
export async function GET() {
  try {
    const [
      transactions,
      categories,
      budgets,
      imports,
      portfolioItems,
      portfolioAccounts,
      portfolioSnapshots,
      settings,
    ] = await Promise.all([
      db.select().from(schema.transactions),
      db.select().from(schema.categories),
      db.select().from(schema.budgets),
      db.select().from(schema.imports),
      db.select().from(schema.portfolioItems),
      db.select().from(schema.portfolioAccounts),
      db.select().from(schema.portfolioSnapshots),
      db.select().from(schema.settings),
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
        exportedAt: new Date().toISOString(),
        version: "2.0", // SQLite version
      },
      success: true,
    });
  } catch (error) {
    console.error("GET /api/data error:", error);
    return NextResponse.json(
      { error: "Failed to export data", success: false },
      { status: 500 }
    );
  }
}

// DELETE /api/data - Clear all data
// Query params:
// - keepCategories=true: Keep categories and settings (for demo data generation)
export async function DELETE(request: NextRequest) {
  try {
    const keepCategories = request.nextUrl.searchParams.get("keepCategories") === "true";

    // Delete in reverse order of dependencies
    await db.delete(schema.portfolioSnapshots);
    await db.delete(schema.portfolioItems);
    await db.delete(schema.portfolioAccounts);
    await db.delete(schema.budgets);
    await db.delete(schema.transactions);
    await db.delete(schema.imports);

    if (!keepCategories) {
      await db.delete(schema.categories);
      await db.delete(schema.settings);
    }

    return NextResponse.json({
      data: { cleared: true, keptCategories: keepCategories },
      success: true,
    });
  } catch (error) {
    console.error("DELETE /api/data error:", error);
    return NextResponse.json(
      { error: "Failed to clear data", success: false },
      { status: 500 }
    );
  }
}

// POST /api/data - Import data (restore from backup)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const now = new Date();

    // Clear existing data first
    await db.delete(schema.portfolioSnapshots);
    await db.delete(schema.portfolioItems);
    await db.delete(schema.portfolioAccounts);
    await db.delete(schema.budgets);
    await db.delete(schema.transactions);
    await db.delete(schema.imports);
    await db.delete(schema.categories);
    await db.delete(schema.settings);

    // Import categories first (for foreign key references)
    const categoryIdMap = new Map<number, number>();
    if (body.categories?.length) {
      for (const cat of body.categories) {
        const oldId = cat.id;
        const result = await db.insert(schema.categories).values({
          uuid: cat.uuid || randomUUID(),
          name: cat.name,
          keywords: cat.keywords || [],
          order: cat.order ?? 0,
          isSystem: cat.isSystem ?? false,
          createdAt: cat.createdAt ? new Date(cat.createdAt) : now,
          updatedAt: cat.updatedAt ? new Date(cat.updatedAt) : now,
        }).returning({ id: schema.categories.id });
        if (oldId && result[0]) {
          categoryIdMap.set(oldId, result[0].id);
        }
      }
    }

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
          uuid: t.uuid || randomUUID(),
          date: new Date(t.date),
          description: t.description,
          matchField: t.matchField || t.description,
          amountOut: t.amountOut ?? 0,
          amountIn: t.amountIn ?? 0,
          netAmount: t.netAmount ?? (t.amountIn - t.amountOut),
          source: t.source || "Manual",
          categoryId: t.categoryId ? (categoryIdMap.get(t.categoryId) ?? null) : null,
          importId: t.importId ? (importIdMap.get(t.importId) ?? null) : null,
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
          uuid: acc.uuid || randomUUID(),
          bucket: acc.bucket,
          name: acc.name,
          order: acc.order ?? 0,
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
            uuid: item.uuid || randomUUID(),
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
            isInternational: item.isInternational || null,
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
          uuid: snap.uuid || randomUUID(),
          date: new Date(snap.date),
          totalSavings: snap.totalSavings ?? 0,
          totalInvestments: snap.totalInvestments ?? 0,
          totalAssets: snap.totalAssets ?? 0,
          totalDebt: snap.totalDebt ?? 0,
          netWorth: snap.netWorth ?? 0,
          details: snap.details || { accounts: [], items: [] },
          createdAt: snap.createdAt ? new Date(snap.createdAt) : now,
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
        },
      },
      success: true,
    });
  } catch (error) {
    console.error("POST /api/data error:", error);
    return NextResponse.json(
      { error: `Failed to import data: ${(error as Error).message}`, success: false },
      { status: 500 }
    );
  }
}
