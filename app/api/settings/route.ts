import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { refreshScheduler } from "@/lib/services/scheduler";

// GET /api/settings?key=SETTING_KEY
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const key = request.nextUrl.searchParams.get("key");

    if (key) {
      // Get specific setting for this user
      const result = await db
        .select()
        .from(schema.settings)
        .where(
          and(
            eq(schema.settings.key, key),
            eq(schema.settings.userId, userId)
          )
        )
        .limit(1);

      if (result.length === 0) {
        return NextResponse.json({ data: null, success: true });
      }

      return NextResponse.json({ data: result[0].value, success: true });
    }

    // Get all settings for this user
    const results = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.userId, userId));
    const settingsMap = Object.fromEntries(results.map((s) => [s.key, s.value]));

    return NextResponse.json({ data: settingsMap, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings", success: false },
      { status: 500 }
    );
  }
}

// PUT /api/settings
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const { key, value } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "Key and value are required", success: false },
        { status: 400 }
      );
    }

    // Upsert: insert or update on conflict for this user
    const existing = await db
      .select()
      .from(schema.settings)
      .where(
        and(
          eq(schema.settings.key, key),
          eq(schema.settings.userId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.settings)
        .set({ value: String(value) })
        .where(
          and(
            eq(schema.settings.key, key),
            eq(schema.settings.userId, userId)
          )
        );
    } else {
      await db.insert(schema.settings).values({
        key,
        value: String(value),
        userId,
      });
    }

    // The snapshot cron interprets its time in the configured timezone;
    // reschedule so a timezone change takes effect without a restart
    if (key === "TIMEZONE") {
      try {
        await refreshScheduler();
      } catch (schedulerError) {
        console.error("Failed to refresh scheduler after timezone change:", schedulerError);
      }
    }

    return NextResponse.json({ data: { key, value }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("PUT /api/settings error:", error);
    return NextResponse.json(
      { error: "Failed to save setting", success: false },
      { status: 500 }
    );
  }
}
