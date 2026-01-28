/**
 * API Route: Sync Plaid Balances
 * POST /api/plaid/balances/sync
 *
 * Fetches current balances for all user's Plaid accounts and updates linked portfolio items.
 * Can be triggered manually or by the scheduler.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-helper";
import { db } from "@/lib/db/connection";
import { plaidItems, plaidAccounts, portfolioItems, settings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createPlaidClient } from "@/lib/plaid/client";
import { decrypt } from "@/lib/encryption";
import type { PlaidCredentials } from "@/lib/plaid/types";
import { PLAID_SETTINGS_KEYS } from "@/lib/plaid/types";

interface SyncResult {
  success: boolean;
  accountsUpdated: number;
  accountsFailed: number;
  errors: string[];
  syncedAccounts: Array<{
    accountId: string;
    name: string;
    balance: number;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    // Get Plaid credentials from settings
    const credentialsRows = await db
      .select()
      .from(settings)
      .where(
        and(
          eq(settings.userId, userId),
          eq(settings.key, PLAID_SETTINGS_KEYS.CLIENT_ID)
        )
      );

    if (!credentialsRows || credentialsRows.length === 0) {
      return NextResponse.json(
        { error: "Plaid credentials not configured" },
        { status: 400 }
      );
    }

    const secretRows = await db
      .select()
      .from(settings)
      .where(
        and(
          eq(settings.userId, userId),
          eq(settings.key, PLAID_SETTINGS_KEYS.SECRET)
        )
      );

    if (!secretRows || secretRows.length === 0) {
      return NextResponse.json(
        { error: "Plaid credentials not configured" },
        { status: 400 }
      );
    }

    // Decrypt credentials
    const clientId = decrypt(credentialsRows[0].value);
    const secret = decrypt(secretRows[0].value);

    // Get all Plaid items for this user
    const userPlaidItems = await db
      .select()
      .from(plaidItems)
      .where(eq(plaidItems.userId, userId));

    if (userPlaidItems.length === 0) {
      return NextResponse.json({
        success: true,
        accountsUpdated: 0,
        accountsFailed: 0,
        errors: [],
        syncedAccounts: [],
        message: "No Plaid accounts connected",
      });
    }

    const result: SyncResult = {
      success: true,
      accountsUpdated: 0,
      accountsFailed: 0,
      errors: [],
      syncedAccounts: [],
    };

    // Process each Plaid item
    for (const item of userPlaidItems) {
      try {
        // Decrypt access token
        const accessToken = decrypt(item.accessToken);

        // Create Plaid client with user's credentials
        const credentials: PlaidCredentials = {
          clientId,
          secret,
          environment: item.environment as "sandbox" | "development" | "production",
        };

        const client = createPlaidClient(credentials);

        // Fetch balances
        const balanceResponse = await client.accountsBalanceGet({
          access_token: accessToken,
        });

        // Get Plaid accounts for this item that are linked to portfolio accounts
        const linkedAccounts = await db
          .select({
            plaidAccount: plaidAccounts,
            portfolioItem: portfolioItems,
          })
          .from(plaidAccounts)
          .innerJoin(
            portfolioItems,
            eq(plaidAccounts.portfolioAccountId, portfolioItems.accountId)
          )
          .where(
            and(
              eq(plaidAccounts.plaidItemId, item.id),
              eq(plaidAccounts.userId, userId)
            )
          );

        // Update portfolio items with current balances
        for (const account of balanceResponse.data.accounts) {
          const linkedAccount = linkedAccounts.find(
            (la) => la.plaidAccount.accountId === account.account_id
          );

          if (linkedAccount) {
            const balance = account.balances.current || 0;

            // Update portfolio item
            await db
              .update(portfolioItems)
              .set({
                currentValue: balance,
                updatedAt: new Date(),
              })
              .where(eq(portfolioItems.id, linkedAccount.portfolioItem.id));

            result.accountsUpdated++;
            result.syncedAccounts.push({
              accountId: account.account_id,
              name: linkedAccount.plaidAccount.name,
              balance,
            });
          }
        }

        // Update item last sync timestamp
        await db
          .update(plaidItems)
          .set({
            lastSync: new Date(),
            status: "active",
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(plaidItems.id, item.id));
      } catch (error: any) {
        result.accountsFailed++;
        const errorMessage = error?.response?.data?.error_message || error.message || "Unknown error";
        result.errors.push(`${item.institutionName}: ${errorMessage}`);

        // Update item status
        await db
          .update(plaidItems)
          .set({
            status: "error",
            errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(plaidItems.id, item.id));
      }
    }

    // Update last sync timestamp in settings
    const lastSyncSetting = await db
      .select()
      .from(settings)
      .where(
        and(
          eq(settings.userId, userId),
          eq(settings.key, PLAID_SETTINGS_KEYS.LAST_SYNC)
        )
      );

    const now = new Date();
    if (lastSyncSetting.length > 0) {
      await db
        .update(settings)
        .set({
          value: now.toISOString(),
        })
        .where(eq(settings.id, lastSyncSetting[0].id));
    } else {
      await db.insert(settings).values({
        userId,
        key: PLAID_SETTINGS_KEYS.LAST_SYNC,
        value: now.toISOString(),
      });
    }

    return NextResponse.json({
      success: result.errors.length === 0,
      accountsUpdated: result.accountsUpdated,
      accountsFailed: result.accountsFailed,
      errors: result.errors,
      syncedAccounts: result.syncedAccounts,
      message: result.accountsUpdated > 0 
        ? `Successfully synced ${result.accountsUpdated} account${result.accountsUpdated !== 1 ? 's' : ''}`
        : "No accounts to sync",
    });
  } catch (error: any) {
    console.error("Error syncing Plaid balances:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync balances" },
      { status: 500 }
    );
  }
}
