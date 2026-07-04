/**
 * API Route: Seed Timezone
 * POST /api/settings/timezone
 *
 * Called on first authenticated app load with the browser's timezone.
 * Seeds the TIMEZONE setting only if the user doesn't have one yet
 * (PST fallback for invalid/missing values) — once the user changes it
 * in Settings, that value is authoritative and this becomes a no-op.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { ensureTimezoneSetting } from "@/lib/db/seed";
import { refreshScheduler } from "@/lib/services/scheduler";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    let timezone: string | undefined;
    try {
      const body = await request.json();
      if (typeof body?.timezone === "string") timezone = body.timezone;
    } catch {
      // No body — seed with the PST fallback
    }

    const seeded = await ensureTimezoneSetting(userId, timezone);

    if (seeded) {
      // The running cron job was scheduled without a timezone; re-schedule
      // so the snapshot time is interpreted in the newly seeded one
      try {
        await refreshScheduler();
      } catch (error) {
        console.error("Failed to refresh scheduler after seeding timezone:", error);
      }
    }

    return NextResponse.json({ data: { seeded }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/settings/timezone error:", error);
    return NextResponse.json(
      { error: "Failed to seed timezone", success: false },
      { status: 500 }
    );
  }
}
