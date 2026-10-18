/**
 * API Route: Get Plaid accounts
 * GET /api/plaid/accounts?itemId=123
 *
 * Returns all Plaid accounts for a given Plaid item.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/connection";
import { plaidAccounts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const itemIdParam = searchParams.get("itemId");

    if (!itemIdParam) {
      return NextResponse.json(
        { error: "Missing itemId parameter" },
        { status: 400 }
      );
    }

    const itemId = parseInt(itemIdParam, 10);
    if (isNaN(itemId)) {
      return NextResponse.json(
        { error: "Invalid itemId parameter" },
        { status: 400 }
      );
    }

    // Get all accounts for this item
    const accounts = await db
      .select()
      .from(plaidAccounts)
      .where(and(eq(plaidAccounts.plaidItemId, itemId), eq(plaidAccounts.userId, userId)));

    return NextResponse.json({
      success: true,
      accounts,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching Plaid accounts:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
