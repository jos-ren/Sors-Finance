/**
 * API Route: Check Encryption Configuration
 * GET /api/plaid/encryption-status
 */

import { NextRequest, NextResponse } from "next/server";
import { isEncryptionConfigured } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  try {
    const configured = isEncryptionConfigured();
    
    return NextResponse.json({ configured });
  } catch (error) {
    return NextResponse.json({ configured: false });
  }
}
