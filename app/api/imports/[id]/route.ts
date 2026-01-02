import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/imports/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const importId = parseInt(id, 10);

    if (isNaN(importId)) {
      return NextResponse.json(
        { error: "Invalid import ID", success: false },
        { status: 400 }
      );
    }

    const result = await db
      .select()
      .from(schema.imports)
      .where(eq(schema.imports.id, importId))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Import not found", success: false },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result[0], success: true });
  } catch (error) {
    console.error("GET /api/imports/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch import", success: false },
      { status: 500 }
    );
  }
}

// PATCH /api/imports/[id] - Update import record
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const importId = parseInt(id, 10);

    if (isNaN(importId)) {
      return NextResponse.json(
        { error: "Invalid import ID", success: false },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Check if import exists
    const existing = await db
      .select()
      .from(schema.imports)
      .where(eq(schema.imports.id, importId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Import not found", success: false },
        { status: 404 }
      );
    }

    // Update the import
    await db
      .update(schema.imports)
      .set({
        transactionCount: body.transactionCount ?? existing[0].transactionCount,
        totalAmount: body.totalAmount ?? existing[0].totalAmount,
      })
      .where(eq(schema.imports.id, importId));

    return NextResponse.json({ data: { updated: true }, success: true });
  } catch (error) {
    console.error("PATCH /api/imports/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update import", success: false },
      { status: 500 }
    );
  }
}

// DELETE /api/imports/[id] - Also deletes associated transactions
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const importId = parseInt(id, 10);

    if (isNaN(importId)) {
      return NextResponse.json(
        { error: "Invalid import ID", success: false },
        { status: 400 }
      );
    }

    // Check if import exists
    const existing = await db
      .select()
      .from(schema.imports)
      .where(eq(schema.imports.id, importId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Import not found", success: false },
        { status: 404 }
      );
    }

    // Delete associated transactions first
    await db
      .delete(schema.transactions)
      .where(eq(schema.transactions.importId, importId));

    // Delete the import
    await db.delete(schema.imports).where(eq(schema.imports.id, importId));

    return NextResponse.json({ data: { deleted: true }, success: true });
  } catch (error) {
    console.error("DELETE /api/imports/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete import", success: false },
      { status: 500 }
    );
  }
}
