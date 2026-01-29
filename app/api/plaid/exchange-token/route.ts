/**
 * API Route: Exchange Public Token for Access Token
 * POST /api/plaid/exchange-token
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-helper";
import { db, schema } from "@/lib/db/connection";
import { createPlaidClient, isPlaidConfigured } from "@/lib/plaid/client";
import { mapPlaidTypeToPortfolioBucket, type PlaidEnvironmentType } from "@/lib/plaid/types";
import { randomUUID } from "crypto";
import { CountryCode } from "plaid";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req);

    const body = await req.json();
    const { publicToken, environment = "sandbox" } = body;

    if (!publicToken) {
      return NextResponse.json(
        { error: "Missing public_token" },
        { status: 400 }
      );
    }

    // Check if Plaid is configured
    if (!isPlaidConfigured()) {
      return NextResponse.json(
        { error: "Plaid credentials not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET in your .env file." },
        { status: 400 }
      );
    }

    const client = createPlaidClient(environment as PlaidEnvironmentType);

    // Exchange public token for access token
    const tokenResponse = await client.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = tokenResponse.data.access_token;
    const itemId = tokenResponse.data.item_id;

    // Get item details (institution info)
    const itemResponse = await client.itemGet({
      access_token: accessToken,
    });

    const institutionId = itemResponse.data.item.institution_id!;

    // Get institution name
    const institutionResponse = await client.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Ca],
    });

    // Clean up institution name by removing everything after dash and anything in parentheses
    const rawInstitutionName = institutionResponse.data.institution.name;
    const institutionName = rawInstitutionName
      .replace(/\s*-\s*.*$/, '')  // Remove everything after dash
      .replace(/\s*\(.*?\)/g, '')  // Remove anything in parentheses
      .trim();

    // Get accounts
    const accountsResponse = await client.accountsGet({
      access_token: accessToken,
    });

    const accounts = accountsResponse.data.accounts;

    // Save to database
    const now = new Date();

    // Create plaid_items record
    const [plaidItem] = await db
      .insert(schema.plaidItems)
      .values({
        uuid: randomUUID(),
        userId,
        itemId,
        accessToken: accessToken, // Store access token directly
        institutionId,
        institutionName,
        environment: environment as PlaidEnvironmentType,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Create plaid_accounts records (portfolio accounts will be created later via bucket selection)
    const createdAccounts = [];

    for (const account of accounts) {
      // Calculate suggested bucket for UI (but don't create portfolio account yet)
      const suggestedBucket = mapPlaidTypeToPortfolioBucket(account.type, account.subtype || "");

      // Create plaid_accounts record without portfolio link
      const [plaidAccount] = await db
        .insert(schema.plaidAccounts)
        .values({
          uuid: randomUUID(),
          userId,
          plaidItemId: plaidItem.id,
          accountId: account.account_id,
          name: account.name,
          officialName: account.official_name || undefined,
          type: account.type,
          subtype: account.subtype || "",
          mask: account.mask || undefined,
          portfolioAccountId: null, // Will be set when user selects bucket
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      createdAccounts.push({
        ...plaidAccount,
        suggestedBucket,
        currentBalance: account.balances.current || 0,
      });
    }

    return NextResponse.json({
      success: true,
      item: {
        id: plaidItem.id,
        institutionName,
        accountsCount: createdAccounts.length,
      },
      accounts: createdAccounts.map((acc) => ({
        id: acc.id,
        accountId: acc.accountId, // Plaid account ID
        name: acc.name,
        officialName: acc.officialName,
        type: acc.type,
        subtype: acc.subtype,
        mask: acc.mask,
        suggestedBucket: acc.suggestedBucket,
        currentBalance: acc.currentBalance,
      })),
    });
  } catch (error: unknown) {
    console.error("Token exchange error:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to exchange token" },
      { status: 500 }
    );
  }
}
