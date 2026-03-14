import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/import-drafts/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);

    const { id } = await context.params;
    const draftId = parseInt(id, 10);

    if (isNaN(draftId)) {
      return NextResponse.json(
        { error: "Invalid draft ID", success: false },
        { status: 400 }
      );
    }

    const result = await db
      .select()
      .from(schema.importDrafts)
      .where(
        and(
          eq(schema.importDrafts.id, draftId),
          eq(schema.importDrafts.userId, userId)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Draft not found", success: false },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result[0], success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/import-drafts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch draft", success: false },
      { status: 500 }
    );
  }
}

// DELETE /api/import-drafts/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);

    const { id } = await context.params;
    const draftId = parseInt(id, 10);

    if (isNaN(draftId)) {
      return NextResponse.json(
        { error: "Invalid draft ID", success: false },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(schema.importDrafts)
      .where(
        and(
          eq(schema.importDrafts.id, draftId),
          eq(schema.importDrafts.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Draft not found", success: false },
        { status: 404 }
      );
    }

    await db
      .delete(schema.importDrafts)
      .where(
        and(
          eq(schema.importDrafts.id, draftId),
          eq(schema.importDrafts.userId, userId)
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
    console.error("DELETE /api/import-drafts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete draft", success: false },
      { status: 500 }
    );
  }
}
