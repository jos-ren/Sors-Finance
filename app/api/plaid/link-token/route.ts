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

    // Parse body to get environment selection
    const body = await req.json().catch(() => ({}));
    const { accessToken, environment = "sandbox" } = body;

    // Check if Plaid is configured for the requested environment
    if (!isPlaidConfigured(environment as PlaidEnvironmentType)) {
      return NextResponse.json(
        { error: `Plaid ${environment} credentials not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET_${(environment as string).toUpperCase()} in your .env file.` },
        { status: 400 }
      );
    }

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
    const err = error as {
      response?: { data?: { error_message?: string; error_code?: string } };
      message?: string;
    };
    const errorMessage =
      err?.response?.data?.error_message ||
      err?.response?.data?.error_code ||
      err.message ||
      "Failed to create link token";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
