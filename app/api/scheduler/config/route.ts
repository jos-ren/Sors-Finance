import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq } from "drizzle-orm";

const SNAPSHOT_TIME_KEY = "SNAPSHOT_TIME";
const SNAPSHOT_ENABLED_KEY = "SNAPSHOT_ENABLED";

// GET /api/scheduler/config
export async function GET() {
  try {
    const timeResult = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, SNAPSHOT_TIME_KEY))
      .limit(1);

    const enabledResult = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, SNAPSHOT_ENABLED_KEY))
      .limit(1);

    return NextResponse.json({
      data: {
        time: timeResult[0]?.value || "03:00",
        enabled: enabledResult[0]?.value !== "false",
      },
      success: true,
    });
  } catch (error) {
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
    const { time, enabled } = await request.json();

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
        .where(eq(schema.settings.key, SNAPSHOT_TIME_KEY))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(schema.settings)
          .set({ value: time })
          .where(eq(schema.settings.key, SNAPSHOT_TIME_KEY));
      } else {
        await db.insert(schema.settings).values({
          key: SNAPSHOT_TIME_KEY,
          value: time,
        });
      }
    }

    // Update enabled if provided
    if (enabled !== undefined) {
      const existing = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, SNAPSHOT_ENABLED_KEY))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(schema.settings)
          .set({ value: String(enabled) })
          .where(eq(schema.settings.key, SNAPSHOT_ENABLED_KEY));
      } else {
        await db.insert(schema.settings).values({
          key: SNAPSHOT_ENABLED_KEY,
          value: String(enabled),
        });
      }
    }

    return NextResponse.json({ data: { updated: true }, success: true });
  } catch (error) {
    console.error("PUT /api/scheduler/config error:", error);
    return NextResponse.json(
      { error: "Failed to update scheduler config", success: false },
      { status: 500 }
    );
  }
}
