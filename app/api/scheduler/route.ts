/**
 * API Route: Scheduler Settings
 * GET /api/scheduler - Get scheduler settings
 * PUT /api/scheduler - Update scheduler settings
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-helper";
import { db } from "@/lib/db/connection";
import { settings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const SNAPSHOT_ENABLED_KEY = "SNAPSHOT_ENABLED";
const PLAID_SYNC_ENABLED_KEY = "PLAID_SYNC_ENABLED";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    // Get snapshot enabled setting
    const snapshotSetting = await db
      .select()
      .from(settings)
      .where(
        and(
          eq(settings.userId, userId),
          eq(settings.key, SNAPSHOT_ENABLED_KEY)
        )
      )
      .limit(1);

    // Get Plaid sync enabled setting
    const plaidSyncSetting = await db
      .select()
      .from(settings)
      .where(
        and(
          eq(settings.userId, userId),
          eq(settings.key, PLAID_SYNC_ENABLED_KEY)
        )
      )
      .limit(1);

    return NextResponse.json({
      snapshotEnabled: snapshotSetting[0]?.value !== "false", // Default true
      plaidSyncEnabled: plaidSyncSetting[0]?.value !== "false", // Default true
    });
  } catch (error: unknown) {
    console.error("Error getting scheduler settings:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to get settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const body = await request.json();
    const { snapshotEnabled, plaidSyncEnabled } = body;

    // Update snapshot enabled setting
    if (typeof snapshotEnabled === "boolean") {
      const existing = await db
        .select()
        .from(settings)
        .where(
          and(
            eq(settings.userId, userId),
            eq(settings.key, SNAPSHOT_ENABLED_KEY)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(settings)
          .set({ value: snapshotEnabled ? "true" : "false" })
          .where(eq(settings.id, existing[0].id));
      } else {
        await db.insert(settings).values({
          userId,
          key: SNAPSHOT_ENABLED_KEY,
          value: snapshotEnabled ? "true" : "false",
        });
      }
    }

    // Update Plaid sync enabled setting
    if (typeof plaidSyncEnabled === "boolean") {
      const existing = await db
        .select()
        .from(settings)
        .where(
          and(
            eq(settings.userId, userId),
            eq(settings.key, PLAID_SYNC_ENABLED_KEY)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(settings)
          .set({ value: plaidSyncEnabled ? "true" : "false" })
          .where(eq(settings.id, existing[0].id));
      } else {
        await db.insert(settings).values({
          userId,
          key: PLAID_SYNC_ENABLED_KEY,
          value: plaidSyncEnabled ? "true" : "false",
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error updating scheduler settings:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}
