/**
 * API Route: Encrypt Credentials
 * POST /api/plaid/encrypt-credentials
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-helper";
import { encrypt } from "@/lib/encryption";

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);

    const body = await req.json();
    const { clientId, secret } = body;

    if (!clientId || !secret) {
      return NextResponse.json(
        { error: "Missing clientId or secret" },
        { status: 400 }
      );
    }

    // Encrypt the credentials
    const encryptedClientId = encrypt(clientId);
    const encryptedSecret = encrypt(secret);

    return NextResponse.json({
      encryptedClientId,
      encryptedSecret,
    });
  } catch (error: any) {
    console.error("Encryption error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to encrypt credentials" },
      { status: 500 }
    );
  }
}
