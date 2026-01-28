/**
 * API Route: Test Plaid Credentials
 * POST /api/plaid/test
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-helper";
import { testPlaidCredentials } from "@/lib/plaid/client";
import type { PlaidCredentials } from "@/lib/plaid/types";

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);

    const body = await req.json();
    const { clientId, secret, environment } = body;

    if (!clientId || !secret || !environment) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const credentials: PlaidCredentials = {
      clientId,
      secret,
      environment,
    };

    const result = await testPlaidCredentials(credentials);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Plaid test error:", error);
    return NextResponse.json(
      { error: "Failed to test Plaid credentials" },
      { status: 500 }
    );
  }
}
