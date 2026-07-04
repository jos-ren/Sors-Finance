/**
 * API Route: Test Plaid Credentials
 * GET /api/plaid/test
 * 
 * Tests if Plaid credentials from environment variables are valid
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-helper";
import { testPlaidCredentials, isPlaidConfigured } from "@/lib/plaid/client";
import type { PlaidEnvironmentType } from "@/lib/plaid/types";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const environment = (req.nextUrl.searchParams.get("environment") || "production") as PlaidEnvironmentType;

    if (!isPlaidConfigured(environment)) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          error: `Plaid ${environment} credentials not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET_${environment.toUpperCase()} in your .env file.`
        },
        { status: 400 }
      );
    }

    const result = await testPlaidCredentials(environment);

    if (result.success) {
      return NextResponse.json({ 
        success: true,
        configured: true,
        message: "Plaid credentials are valid"
      });
    } else {
      return NextResponse.json(
        { success: false, configured: true, error: result.error },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    console.error("Plaid test error:", error);
    return NextResponse.json(
      { error: "Failed to test Plaid credentials" },
      { status: 500 }
    );
  }
}
