import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq } from "drizzle-orm";

// GET /api/settings?key=SETTING_KEY
export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get("key");

    if (key) {
      // Get specific setting
      const result = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, key))
        .limit(1);

      if (result.length === 0) {
        return NextResponse.json({ data: null, success: true });
      }

      return NextResponse.json({ data: result[0].value, success: true });
    }

    // Get all settings
    const results = await db.select().from(schema.settings);
    const settingsMap = Object.fromEntries(results.map((s) => [s.key, s.value]));

    return NextResponse.json({ data: settingsMap, success: true });
  } catch (error) {
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
    const { key, value } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "Key and value are required", success: false },
        { status: 400 }
      );
    }

    // Upsert: insert or update on conflict
    const existing = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.settings)
        .set({ value: String(value) })
        .where(eq(schema.settings.key, key));
    } else {
      await db.insert(schema.settings).values({
        key,
        value: String(value),
      });
    }

    return NextResponse.json({ data: { key, value }, success: true });
  } catch (error) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json(
      { error: "Failed to save setting", success: false },
      { status: 500 }
    );
  }
}
