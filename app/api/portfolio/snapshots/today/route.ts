/**
 * API Route: Create/Update Today's Snapshot
 * POST /api/portfolio/snapshots/today
 * 
 * Creates or updates a snapshot for today with current portfolio totals.
 * Can optionally skip sync/refresh if they already happened.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-helper";
import { db } from "@/lib/db/connection";
import { portfolioSnapshots, portfolioAccounts, portfolioItems } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    
    // Parse optional skipSync flag
    let skipSync = false;
    try {
      const body = await request.json();
      skipSync = body?.skipSync || false;
    } catch {
      // No body or invalid JSON
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Check if snapshot already exists today
    const existingSnapshots = await db
      .select()
      .from(portfolioSnapshots)
      .where(
        and(
          eq(portfolioSnapshots.userId, userId),
          gte(portfolioSnapshots.date, startOfDay),
          lte(portfolioSnapshots.date, endOfDay)
        )
      )
      .limit(1);

    // Get current portfolio totals
    const accounts = await db
      .select()
      .from(portfolioAccounts)
      .where(eq(portfolioAccounts.userId, userId));

    const items = await db
      .select()
      .from(portfolioItems)
      .where(
        and(
          eq(portfolioItems.userId, userId),
          eq(portfolioItems.isActive, true)
        )
      );

    // Calculate totals by bucket
    let totalSavings = 0;
    let totalInvestments = 0;
    let totalAssets = 0;
    let totalDebt = 0;

    const accountDetails: Array<{ id: number; bucket: string; name: string; total: number }> = [];
    const itemDetails: Array<{ id: number; accountId: number; name: string; value: number }> = [];

    for (const account of accounts) {
      const accountItems = items.filter(item => item.accountId === account.id);
      const accountTotal = accountItems.reduce((sum, item) => sum + (item.currentValue || 0), 0);

      accountDetails.push({
        id: account.id!,
        bucket: account.bucket,
        name: account.name,
        total: accountTotal,
      });

      // Add items to details
      for (const item of accountItems) {
        itemDetails.push({
          id: item.id!,
          accountId: item.accountId!,
          name: item.name,
          value: item.currentValue || 0,
        });
      }

      switch (account.bucket) {
        case "Savings":
          totalSavings += accountTotal;
          break;
        case "Investments":
          totalInvestments += accountTotal;
          break;
        case "Assets":
          totalAssets += accountTotal;
          break;
        case "Debt":
          totalDebt += accountTotal;
          break;
      }
    }

    const netWorth = totalSavings + totalInvestments + totalAssets - totalDebt;
    
    const snapshotDetails = {
      accounts: accountDetails,
      items: itemDetails,
    };

    // Create or update snapshot
    if (existingSnapshots.length > 0) {
      // Update existing snapshot
      await db
        .update(portfolioSnapshots)
        .set({
          totalSavings,
          totalInvestments,
          totalAssets,
          totalDebt,
          netWorth,
          details: snapshotDetails,
        })
        .where(eq(portfolioSnapshots.id, existingSnapshots[0].id!));

      return NextResponse.json({
        success: true,
        snapshotId: existingSnapshots[0].id,
        action: "updated",
        netWorth,
      });
    } else {
      // Create new snapshot
      const result = await db
        .insert(portfolioSnapshots)
        .values({
          userId,
          uuid: crypto.randomUUID(),
          date: now,
          totalSavings,
          totalInvestments,
          totalAssets,
          totalDebt,
          netWorth,
          details: snapshotDetails,
          createdAt: now,
        })
        .returning({ id: portfolioSnapshots.id });

      return NextResponse.json({
        success: true,
        snapshotId: result[0].id,
        action: "created",
        netWorth,
      });
    }
  } catch (error: unknown) {
    console.error("Error creating/updating today's snapshot:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to create/update snapshot" },
      { status: 500 }
    );
  }
}
