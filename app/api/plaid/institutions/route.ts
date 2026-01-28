/**
 * API Route: Get Connected Plaid Institutions
 * GET /api/plaid/institutions
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-helper";
import { db, schema } from "@/lib/db/connection";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req);

    // Get all plaid items for this user
    const items = await db
      .select()
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.userId, userId));

    // Get accounts for each item
    const itemsWithAccounts = await Promise.all(
      items.map(async (item) => {
        const accounts = await db
          .select({
            account: schema.plaidAccounts,
            portfolioAccount: schema.portfolioAccounts,
          })
          .from(schema.plaidAccounts)
          .leftJoin(
            schema.portfolioAccounts,
            eq(schema.plaidAccounts.portfolioAccountId, schema.portfolioAccounts.id)
          )
          .where(eq(schema.plaidAccounts.plaidItemId, item.id));

        return {
          id: item.id,
          institutionId: item.institutionId,
          institutionName: item.institutionName,
          status: item.status,
          lastSync: item.lastSync,
          errorMessage: item.errorMessage,
          accounts: accounts.map((row) => ({
            id: row.account.id,
            accountId: row.account.accountId,
            name: row.account.name,
            officialName: row.account.officialName,
            type: row.account.type,
            subtype: row.account.subtype,
            mask: row.account.mask,
            portfolioAccountId: row.account.portfolioAccountId,
            portfolioAccountName: row.portfolioAccount?.name || null,
            portfolioBucket: row.portfolioAccount?.bucket || null,
          })),
        };
      })
    );

    return NextResponse.json({ institutions: itemsWithAccounts });
  } catch (error: any) {
    console.error("Get institutions error:", error);
    return NextResponse.json(
      { error: "Failed to get institutions" },
      { status: 500 }
    );
  }
}
