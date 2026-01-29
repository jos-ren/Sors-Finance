import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

const SNAPSHOT_TIME_KEY = "SNAPSHOT_TIME";
const SNAPSHOT_ENABLED_KEY = "SNAPSHOT_ENABLED";
const PLAID_SYNC_WITH_SNAPSHOT_KEY = "PLAID_SYNC_WITH_SNAPSHOT";

// GET /api/scheduler/config
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const timeResult = await db
      .select()
      .from(schema.settings)
      .where(
        and(
          eq(schema.settings.key, SNAPSHOT_TIME_KEY),
          eq(schema.settings.userId, userId)
        )
      )
      .limit(1);

    const enabledResult = await db
      .select()
      .from(schema.settings)
      .where(
        and(
          eq(schema.settings.key, SNAPSHOT_ENABLED_KEY),
          eq(schema.settings.userId, userId)
        )
      )
      .limit(1);

    const plaidSyncResult = await db
      .select()
      .from(schema.settings)
      .where(
        and(
          eq(schema.settings.key, PLAID_SYNC_WITH_SNAPSHOT_KEY),
          eq(schema.settings.userId, userId)
        )
      )
      .limit(1);

    return NextResponse.json({
      data: {
        time: timeResult[0]?.value || "03:00",
        enabled: enabledResult[0]?.value !== "false",
        plaidSync: plaidSyncResult[0]?.value === "true", // Opt-in: default false
      },
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/scheduler/config error:", error);
    return NextResponse.json(
      { error: "Failed to fetch scheduler config", success: false },
      { status: 500 }
    );
  }
}

// PUT /api/scheduler/config
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const { time, enabled, plaidSync } = await request.json();

    // Update time if provided
    if (time !== undefined) {
      // Validate time format (HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(time)) {
        return NextResponse.json(
          { error: "Invalid time format. Use HH:MM (24-hour)", success: false },
          { status: 400 }
        );
      }

      const existing = await db
        .select()
        .from(schema.settings)
        .where(
          and(
            eq(schema.settings.key, SNAPSHOT_TIME_KEY),
            eq(schema.settings.userId, userId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(schema.settings)
          .set({ value: time })
          .where(
            and(
              eq(schema.settings.key, SNAPSHOT_TIME_KEY),
              eq(schema.settings.userId, userId)
            )
          );
      } else {
        await db.insert(schema.settings).values({
          key: SNAPSHOT_TIME_KEY,
          value: time,
          userId,
        });
      }
    }

    // Update enabled if provided
    if (enabled !== undefined) {
      const existing = await db
        .select()
        .from(schema.settings)
        .where(
          and(
            eq(schema.settings.key, SNAPSHOT_ENABLED_KEY),
            eq(schema.settings.userId, userId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(schema.settings)
          .set({ value: String(enabled) })
          .where(
            and(
              eq(schema.settings.key, SNAPSHOT_ENABLED_KEY),
              eq(schema.settings.userId, userId)
            )
          );
      } else {
        await db.insert(schema.settings).values({
          key: SNAPSHOT_ENABLED_KEY,
          value: String(enabled),
          userId,
        });
      }
    }

    // Update plaidSync if provided
    if (plaidSync !== undefined) {
      const existing = await db
        .select()
        .from(schema.settings)
        .where(
          and(
            eq(schema.settings.key, PLAID_SYNC_WITH_SNAPSHOT_KEY),
            eq(schema.settings.userId, userId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(schema.settings)
          .set({ value: String(plaidSync) })
          .where(
            and(
              eq(schema.settings.key, PLAID_SYNC_WITH_SNAPSHOT_KEY),
              eq(schema.settings.userId, userId)
            )
          );
      } else {
        await db.insert(schema.settings).values({
          key: PLAID_SYNC_WITH_SNAPSHOT_KEY,
          value: String(plaidSync),
          userId,
        });
      }
    }

    return NextResponse.json({ data: { updated: true }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("PUT /api/scheduler/config error:", error);
    return NextResponse.json(
      { error: "Failed to update scheduler config", success: false },
      { status: 500 }
    );
  }
}
