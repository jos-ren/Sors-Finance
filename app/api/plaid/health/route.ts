/**
 * API Route: Plaid connection health
 *
 * GET  /api/plaid/health  → stored statuses, no Plaid call
 * POST /api/plaid/health  → asks Plaid (free /item/get) when the last check is stale
 *   body: { preAction?: boolean, force?: boolean }
 *   preAction uses a 30 minute window (before an import or sync); otherwise 6 hours.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import {
  checkPlaidHealth,
  getPlaidHealth,
  HEALTH_MAX_AGE_MS,
  HEALTH_PRE_ACTION_MAX_AGE_MS,
} from "@/lib/plaid/health";

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
  }
  console.error("Plaid health error:", error);
  return NextResponse.json({ error: "Failed to check bank connections", success: false }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    return NextResponse.json({ data: await getPlaidHealth(userId), success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const body = await request.json().catch(() => ({}));
    const data = await checkPlaidHealth(userId, {
      maxAgeMs: body?.preAction ? HEALTH_PRE_ACTION_MAX_AGE_MS : HEALTH_MAX_AGE_MS,
      force: body?.force === true,
    });
    return NextResponse.json({ data, success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
