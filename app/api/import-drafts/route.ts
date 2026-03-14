import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { desc, eq } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";

// GET /api/import-drafts
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const results = await db
      .select()
      .from(schema.importDrafts)
      .where(eq(schema.importDrafts.userId, userId))
      .orderBy(desc(schema.importDrafts.updatedAt));

    const drafts = results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      name: row.name,
      importSource: row.importSource,
      currentStep: row.currentStep,
      transactionCount: row.transactionCount,
      draftData: row.draftData,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return NextResponse.json({ data: drafts, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/import-drafts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch import drafts", success: false },
      { status: 500 }
    );
  }
}

// POST /api/import-drafts - Create or update (upsert by uuid)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const { uuid, name, importSource, currentStep, transactionCount, draftData } =
      await request.json();

    if (!name || !importSource || !currentStep || !draftData) {
      return NextResponse.json(
        { error: "name, importSource, currentStep, and draftData are required", success: false },
        { status: 400 }
      );
    }

    const now = new Date();

    // Check if draft with this uuid already exists
    if (uuid) {
      const existing = await db
        .select()
        .from(schema.importDrafts)
        .where(eq(schema.importDrafts.uuid, uuid))
        .limit(1);

      if (existing.length > 0) {
        // Update existing draft
        await db
          .update(schema.importDrafts)
          .set({
            name,
            importSource,
            currentStep,
            transactionCount: transactionCount ?? 0,
            draftData,
            updatedAt: now,
          })
          .where(eq(schema.importDrafts.uuid, uuid));

        return NextResponse.json({
          data: { id: existing[0].id, uuid },
          success: true,
        });
      }
    }

    // Create new draft
    const draftUuid = uuid || crypto.randomUUID();
    const result = await db
      .insert(schema.importDrafts)
      .values({
        uuid: draftUuid,
        name,
        importSource,
        currentStep,
        transactionCount: transactionCount ?? 0,
        draftData,
        userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: schema.importDrafts.id });

    return NextResponse.json({
      data: { id: result[0].id, uuid: draftUuid },
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/import-drafts error:", error);
    return NextResponse.json(
      { error: "Failed to save import draft", success: false },
      { status: 500 }
    );
  }
}
