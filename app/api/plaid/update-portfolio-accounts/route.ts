/**
 * API Route: Update Portfolio Account Mappings for Plaid Accounts
 * PUT /api/plaid/update-portfolio-accounts
 *
 * Updates portfolio item names and portfolio account assignments for existing Plaid accounts
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-helper";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

type BucketType = "Savings" | "Investments" | "Assets" | "Debt";

interface AccountUpdate {
  plaidAccountId: number; // plaid_accounts.id
  bucket: BucketType;
  portfolioAccountId: number | null; // null means create new
  newAccountName?: string;
  itemName: string; // Name for the portfolio item
}

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req);

    const body = await req.json();
    const { itemId, accountMappings }: { itemId: number; accountMappings: AccountUpdate[] } = body;

    if (!itemId || !accountMappings || accountMappings.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: itemId and accountMappings" },
        { status: 400 }
      );
    }

    const now = new Date();
    const updated: number[] = [];
    const failed: string[] = [];
    const createdPortfolioAccounts = new Map<string, number>();

    // Process each account update
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
          failed.push(`Account ${mapping.plaidAccountId}: Plaid account not found`);
          continue;
        }

        const plaidAccount = plaidAccountRows[0];

        // Find existing portfolio item linked to this plaid account
        // Try by portfolioItems.plaidAccountId first
        let existingItemRows = await db
          .select()
          .from(schema.portfolioItems)
          .where(
            and(
              eq(schema.portfolioItems.plaidAccountId, plaidAccount.id),
              eq(schema.portfolioItems.userId, userId)
            )
          )
          .limit(1);

        // Fallback: find through plaidAccounts.portfolioAccountId link
        if (existingItemRows.length === 0 && plaidAccount.portfolioAccountId) {
          existingItemRows = await db
            .select()
            .from(schema.portfolioItems)
            .where(
              and(
                eq(schema.portfolioItems.accountId, plaidAccount.portfolioAccountId),
                eq(schema.portfolioItems.userId, userId)
              )
            )
            .limit(1);
        }

        if (existingItemRows.length === 0) {
          failed.push(`${plaidAccount.name}: No portfolio item found`);
          continue;
        }

        const existingItem = existingItemRows[0];
        let targetPortfolioAccountId = mapping.portfolioAccountId;

        // If creating a new portfolio account
        if (targetPortfolioAccountId === null) {
          if (!mapping.newAccountName?.trim()) {
            failed.push(`${plaidAccount.name}: Missing account name`);
            continue;
          }

          // Check if we already created this account in this batch
          const cacheKey = `${mapping.bucket}:${mapping.newAccountName}`;
          if (createdPortfolioAccounts.has(cacheKey)) {
            targetPortfolioAccountId = createdPortfolioAccounts.get(cacheKey)!;
          } else {
            // Check if account already exists in target bucket
            const existingAccountRows = await db
              .select()
              .from(schema.portfolioAccounts)
              .where(
                and(
                  eq(schema.portfolioAccounts.bucket, mapping.bucket),
                  eq(schema.portfolioAccounts.name, mapping.newAccountName),
                  eq(schema.portfolioAccounts.userId, userId)
                )
              )
              .limit(1);

            if (existingAccountRows.length > 0) {
              targetPortfolioAccountId = existingAccountRows[0].id;
            } else {
              // Create new portfolio account
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

              targetPortfolioAccountId = newAccount.id;
              createdPortfolioAccounts.set(cacheKey, targetPortfolioAccountId);
            }
          }
        }

        // Verify the target portfolio account exists and belongs to user
        const targetAccountRows = await db
          .select()
          .from(schema.portfolioAccounts)
          .where(
            and(
              eq(schema.portfolioAccounts.id, targetPortfolioAccountId),
              eq(schema.portfolioAccounts.userId, userId)
            )
          )
          .limit(1);

        if (!targetAccountRows || targetAccountRows.length === 0) {
          failed.push(`${plaidAccount.name}: Invalid portfolio account`);
          continue;
        }

        // If moving to a different portfolio account, update order
        let newOrder = existingItem.order;
        if (existingItem.accountId !== targetPortfolioAccountId) {
          const maxItemOrderRows = await db
            .select()
            .from(schema.portfolioItems)
            .where(eq(schema.portfolioItems.accountId, targetPortfolioAccountId));

          newOrder = maxItemOrderRows.length > 0
            ? Math.max(...maxItemOrderRows.map(i => i.order)) + 1
            : 0;
        }

        // Update portfolio item
        await db
          .update(schema.portfolioItems)
          .set({
            name: mapping.itemName,
            accountId: targetPortfolioAccountId,
            order: newOrder,
            plaidAccountId: plaidAccount.id, // Ensure the link is set
            updatedAt: now,
          })
          .where(eq(schema.portfolioItems.id, existingItem.id));

        // Update plaid_accounts link
        await db
          .update(schema.plaidAccounts)
          .set({
            portfolioAccountId: targetPortfolioAccountId,
            updatedAt: now,
          })
          .where(eq(schema.plaidAccounts.id, mapping.plaidAccountId));

        updated.push(mapping.plaidAccountId);
      } catch (error: unknown) {
        console.error(`Failed to update portfolio item for ${mapping.plaidAccountId}:`, error);
        const err = error as { message?: string };
        failed.push(`Account ${mapping.plaidAccountId}: ${err.message || "Unknown error"}`);
      }
    }

    // Return summary
    return NextResponse.json({
      success: true,
      updated: updated.length,
      failed: failed.length,
      errors: failed.length > 0 ? failed : undefined,
    });
  } catch (error: unknown) {
    console.error("Update portfolio accounts error:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to update portfolio accounts" },
      { status: 500 }
    );
  }
}
