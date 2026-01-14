import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import type { ColumnMapping } from "@/lib/parsers/types";

// GET /api/custom-import-templates
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const results = await db
      .select()
      .from(schema.customImportTemplates)
      .where(eq(schema.customImportTemplates.userId, userId))
      .orderBy(desc(schema.customImportTemplates.createdAt));

    // Parse mapping JSON for each template
    const templates = results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      name: row.name,
      mapping: JSON.parse(row.mapping as string) as ColumnMapping,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return NextResponse.json({ data: templates, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/custom-import-templates error:", error);
    return NextResponse.json(
      { error: "Failed to fetch custom import templates", success: false },
      { status: 500 }
    );
  }
}

// POST /api/custom-import-templates
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const { name, mapping } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "Template name is required", success: false },
        { status: 400 }
      );
    }

    if (!mapping || typeof mapping !== "object") {
      return NextResponse.json(
        { error: "Valid mapping configuration is required", success: false },
        { status: 400 }
      );
    }

    // Validate required mapping fields
    const requiredFields = ["dateColumn", "descriptionColumn", "amountInColumn", "amountOutColumn"];
    for (const field of requiredFields) {
      if (typeof mapping[field] !== "number") {
        return NextResponse.json(
          { error: `Missing or invalid mapping field: ${field}`, success: false },
          { status: 400 }
        );
      }
    }

    const now = new Date();

    const result = await db
      .insert(schema.customImportTemplates)
      .values({
        uuid: randomUUID(),
        name,
        mapping: JSON.stringify(mapping),
        userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: schema.customImportTemplates.id,
        uuid: schema.customImportTemplates.uuid,
      });

    return NextResponse.json({ data: result[0], success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/custom-import-templates error:", error);
    return NextResponse.json(
      { error: "Failed to create custom import template", success: false },
      { status: 500 }
    );
  }
}
