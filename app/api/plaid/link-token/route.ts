/**
 * API Route: Create Plaid Link Token
 * POST /api/plaid/link-token
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-helper";
import { db, schema } from "@/lib/db/connection";
import { decrypt } from "@/lib/encryption";
import { createPlaidClient } from "@/lib/plaid/client";
import { PLAID_SETTINGS_KEYS, type PlaidCredentials, getCredentialKeys, type PlaidEnvironmentType } from "@/lib/plaid/types";
import { CountryCode, Products } from "plaid";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req);

    // Parse body to get environment selection
    const body = await req.json().catch(() => ({}));
    const { accessToken, environment = "sandbox" } = body;

    // Get user's Plaid credentials for the selected environment
    const settingsResult = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.userId, userId));

    const settingsMap = new Map(settingsResult.map((s) => [s.key, s.value]));

    const keys = getCredentialKeys();
    const encryptedClientId = settingsMap.get(keys.clientId);
    const encryptedSecret = settingsMap.get(keys.secret);

    if (!encryptedClientId || !encryptedSecret) {
      return NextResponse.json(
        { error: `Plaid credentials not configured. Please set up credentials in Settings.` },
        { status: 400 }
      );
    }

    // Decrypt credentials
    const credentials: PlaidCredentials = {
      clientId: decrypt(encryptedClientId),
      secret: decrypt(encryptedSecret),
      environment: environment as PlaidEnvironmentType,
    };

    const client = createPlaidClient(credentials);

    // Create link token request
    const request: any = {
      user: {
        client_user_id: userId.toString(),
      },
      client_name: "Sors Finance",
      products: [Products.Transactions, Products.Auth],
      country_codes: [CountryCode.Ca],
      language: "en",
    };

    // If updating an existing item (reconnecting)
    if (accessToken) {
      request.access_token = accessToken;
    }

    const response = await client.linkTokenCreate(request);

    return NextResponse.json({
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
    });
  } catch (error: any) {
    console.error("Link token creation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create link token" },
      { status: 500 }
    );
  }
}
