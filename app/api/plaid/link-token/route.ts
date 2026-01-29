/**
 * API Route: Create Plaid Link Token
 * POST /api/plaid/link-token
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-helper";
import { createPlaidClient, isPlaidConfigured } from "@/lib/plaid/client";
import type { PlaidEnvironmentType } from "@/lib/plaid/types";
import { CountryCode, Products, LinkTokenCreateRequest } from "plaid";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req);

    // Check if Plaid is configured
    if (!isPlaidConfigured()) {
      return NextResponse.json(
        { error: "Plaid credentials not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET in your .env file." },
        { status: 400 }
      );
    }

    // Parse body to get environment selection
    const body = await req.json().catch(() => ({}));
    const { accessToken, environment = "sandbox" } = body;

    const client = createPlaidClient(environment as PlaidEnvironmentType);

    // Create link token request
    const request: LinkTokenCreateRequest = {
      user: {
        client_user_id: userId.toString(),
      },
      client_name: "Sors Finance",
      products: [Products.Transactions],
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
  } catch (error: unknown) {
    console.error("Link token creation error:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to create link token" },
      { status: 500 }
    );
  }
}
