import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db/connection";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { projectBelongsToUser } from "@/lib/projects/projects-db";

// PATCH /api/transactions/project  { ids: number[], projectId: number | null }
// Bulk add transactions to a project, or remove them (projectId: null).
// The category is untouched: the project is a separate dimension.
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const { ids, projectId } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => Number.isInteger(id))) {
      return NextResponse.json({ error: "ids must be a non-empty array of integers", success: false }, { status: 400 });
    }
    if (projectId !== null && !(Number.isInteger(projectId) && (await projectBelongsToUser(userId, projectId)))) {
      return NextResponse.json({ error: "Project not found", success: false }, { status: 404 });
    }

    const result = await db
      .update(schema.transactions)
      .set({ projectId, updatedAt: new Date() })
      .where(and(eq(schema.transactions.userId, userId), inArray(schema.transactions.id, ids)));

    return NextResponse.json({ data: { updated: result.changes }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("PATCH /api/transactions/project error:", error);
    return NextResponse.json({ error: "Failed to update project assignment", success: false }, { status: 500 });
  }
}
