import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import type { ColumnMapping } from "@/lib/parsers/types";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/custom-import-templates/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);

    const { id } = await context.params;
    const templateId = parseInt(id, 10);

    if (isNaN(templateId)) {
      return NextResponse.json(
        { error: "Invalid template ID", success: false },
        { status: 400 }
      );
    }

    const result = await db
      .select()
      .from(schema.customImportTemplates)
      .where(
        and(
          eq(schema.customImportTemplates.id, templateId),
          eq(schema.customImportTemplates.userId, userId)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Template not found", success: false },
        { status: 404 }
      );
    }

    const row = result[0];
    const template = {
      id: row.id,
      uuid: row.uuid,
      name: row.name,
      mapping: JSON.parse(row.mapping as string) as ColumnMapping,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return NextResponse.json({ data: template, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/custom-import-templates/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch template", success: false },
      { status: 500 }
    );
  }
}

// PUT /api/custom-import-templates/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);

    const { id } = await context.params;
    const templateId = parseInt(id, 10);

    if (isNaN(templateId)) {
      return NextResponse.json(
        { error: "Invalid template ID", success: false },
        { status: 400 }
      );
    }

    const updates = await request.json();

    // Check if template exists and belongs to user
    const existing = await db
      .select()
      .from(schema.customImportTemplates)
      .where(
        and(
          eq(schema.customImportTemplates.id, templateId),
          eq(schema.customImportTemplates.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Template not found", success: false },
        { status: 404 }
      );
    }

    // Prepare update values
    const updateValues: Record<string, unknown> = { updatedAt: new Date() };

    if (updates.name !== undefined) {
      updateValues.name = updates.name;
    }

    if (updates.mapping !== undefined) {
      if (typeof updates.mapping !== "object") {
        return NextResponse.json(
          { error: "Invalid mapping configuration", success: false },
          { status: 400 }
        );
      }

      // Validate required mapping fields
      const requiredFields = ["dateColumn", "descriptionColumn", "amountInColumn", "amountOutColumn"];
      for (const field of requiredFields) {
        if (typeof updates.mapping[field] !== "number") {
          return NextResponse.json(
            { error: `Missing or invalid mapping field: ${field}`, success: false },
            { status: 400 }
          );
        }
      }

      updateValues.mapping = JSON.stringify(updates.mapping);
    }

    await db
      .update(schema.customImportTemplates)
      .set(updateValues)
      .where(
        and(
          eq(schema.customImportTemplates.id, templateId),
          eq(schema.customImportTemplates.userId, userId)
        )
      );

    return NextResponse.json({ data: { updated: true }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("PUT /api/custom-import-templates/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update template", success: false },
      { status: 500 }
    );
  }
}

// DELETE /api/custom-import-templates/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);

    const { id } = await context.params;
    const templateId = parseInt(id, 10);

    if (isNaN(templateId)) {
      return NextResponse.json(
        { error: "Invalid template ID", success: false },
        { status: 400 }
      );
    }

    // Check if template exists and belongs to user
    const existing = await db
      .select()
      .from(schema.customImportTemplates)
      .where(
        and(
          eq(schema.customImportTemplates.id, templateId),
          eq(schema.customImportTemplates.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Template not found", success: false },
        { status: 404 }
      );
    }

    // Delete the template
    await db
      .delete(schema.customImportTemplates)
      .where(
        and(
          eq(schema.customImportTemplates.id, templateId),
          eq(schema.customImportTemplates.userId, userId)
        )
      );

    return NextResponse.json({ data: { deleted: true }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("DELETE /api/custom-import-templates/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete template", success: false },
      { status: 500 }
    );
  }
}
