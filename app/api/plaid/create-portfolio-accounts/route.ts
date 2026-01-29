/**
 * API Route: Create Portfolio Accounts from Plaid Accounts
 * POST /api/plaid/create-portfolio-accounts
 * 
 * Creates portfolio items for Plaid accounts, grouping them under user-selected portfolio accounts
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-helper";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

type BucketType = "Savings" | "Investments" | "Assets" | "Debt";

interface AccountMapping {
  plaidAccountId: number; // plaid_accounts.id
  bucket: BucketType;
  portfolioAccountId: number | null; // null means create new
  newAccountName?: string;
  itemName: string; // Name for the portfolio item
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req);

    const body = await req.json();
    const { itemId, accountMappings }: { itemId: number; accountMappings: AccountMapping[] } = body;

    if (!itemId || !accountMappings || accountMappings.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: itemId and accountMappings" },
        { status: 400 }
      );
    }

    const now = new Date();
    const created: number[] = [];
    const failed: string[] = [];
    const createdPortfolioAccounts = new Map<string, number>(); // Track newly created accounts by name

    // Process each account mapping
    for (const mapping of accountMappings) {
      try {
        // Get the plaid_account
        const plaidAccountRows = await db
          .select()
          .from(schema.plaidAccounts)
          .where(
            and(
              eq(schema.plaidAccounts.id, mapping.plaidAccountId),
              eq(schema.plaidAccounts.userId, userId)
            )
          )
          .limit(1);

        if (!plaidAccountRows || plaidAccountRows.length === 0) {
          failed.push(`Account ${mapping.plaidAccountId}: Not found`);
          continue;
        }

        const plaidAccount = plaidAccountRows[0];

        // Check if already linked to a portfolio item
        if (plaidAccount.portfolioAccountId) {
          failed.push(`Account ${plaidAccount.name}: Already linked to portfolio`);
          continue;
        }

        let portfolioAccountId = mapping.portfolioAccountId;

        // If creating a new portfolio account
        if (portfolioAccountId === null) {
          if (!mapping.newAccountName?.trim()) {
            failed.push(`Account ${plaidAccount.name}: Missing account name`);
            continue;
          }

          // Check if we already created this account in this batch
          const cacheKey = `${mapping.bucket}:${mapping.newAccountName}`;
          if (createdPortfolioAccounts.has(cacheKey)) {
            portfolioAccountId = createdPortfolioAccounts.get(cacheKey)!;
          } else {
            // Get max order for this bucket
            const maxOrderRows = await db
              .select()
              .from(schema.portfolioAccounts)
              .where(
                and(
                  eq(schema.portfolioAccounts.bucket, mapping.bucket),
                  eq(schema.portfolioAccounts.userId, userId)
                )
              );

            const maxOrder = maxOrderRows.length > 0 
              ? Math.max(...maxOrderRows.map(a => a.order))
              : -1;

            // Create new portfolio account
            const [newAccount] = await db
              .insert(schema.portfolioAccounts)
              .values({
                uuid: randomUUID(),
                bucket: mapping.bucket,
                name: mapping.newAccountName,
                order: maxOrder + 1,
                userId,
                createdAt: now,
                updatedAt: now,
              })
              .returning();

            portfolioAccountId = newAccount.id;
            createdPortfolioAccounts.set(cacheKey, portfolioAccountId);
          }
        }

        // Verify the portfolio account exists and belongs to user
        const portfolioAccountRows = await db
          .select()
          .from(schema.portfolioAccounts)
          .where(
            and(
              eq(schema.portfolioAccounts.id, portfolioAccountId),
              eq(schema.portfolioAccounts.userId, userId)
            )
          )
          .limit(1);

        if (!portfolioAccountRows || portfolioAccountRows.length === 0) {
          failed.push(`Account ${plaidAccount.name}: Invalid portfolio account`);
          continue;
        }

        // Get max order for items in this portfolio account
        const maxItemOrderRows = await db
          .select()
          .from(schema.portfolioItems)
          .where(eq(schema.portfolioItems.accountId, portfolioAccountId));

        const maxItemOrder = maxItemOrderRows.length > 0
          ? Math.max(...maxItemOrderRows.map(i => i.order))
          : -1;

        // Create portfolio item
        await db
          .insert(schema.portfolioItems)
          .values({
            uuid: randomUUID(),
            accountId: portfolioAccountId,
            name: mapping.itemName, // Use the user-provided item name
            currentValue: 0, // Will be updated on first balance sync
            order: maxItemOrder + 1,
            isActive: true,
            plaidAccountId: plaidAccount.id, // Link back to plaid account
            userId,
            createdAt: now,
            updatedAt: now,
          });

        // Update plaid_accounts to link to portfolio account
        await db
          .update(schema.plaidAccounts)
          .set({
            portfolioAccountId: portfolioAccountId,
            updatedAt: now,
          })
          .where(eq(schema.plaidAccounts.id, mapping.plaidAccountId));

        created.push(mapping.plaidAccountId);
      } catch (error: unknown) {
        console.error(`Failed to create portfolio item for ${mapping.plaidAccountId}:`, error);
        const err = error as { message?: string };
        failed.push(`Account ${mapping.plaidAccountId}: ${err.message || "Unknown error"}`);
      }
    }

    // Return summary
    return NextResponse.json({
      success: true,
      created: created.length,
      failed: failed.length,
      errors: failed.length > 0 ? failed : undefined,
    });
  } catch (error: unknown) {
    console.error("Create portfolio accounts error:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to create portfolio accounts" },
      { status: 500 }
    );
  }
}
