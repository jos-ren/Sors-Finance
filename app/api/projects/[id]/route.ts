import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/connection";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { getProjectDetail, isValidWindow, parseProjectInput } from "@/lib/projects/projects-db";

type RouteContext = { params: Promise<{ id: string }> };

async function projectId(context: RouteContext): Promise<number | null> {
  const id = parseInt((await context.params).id, 10);
  return Number.isNaN(id) ? null : id;
}

function errorResponse(error: unknown, label: string, message: string) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
  }
  console.error(`${label} error:`, error);
  return NextResponse.json({ error: message, success: false }, { status: 500 });
}

const notFound = () => NextResponse.json({ error: "Project not found", success: false }, { status: 404 });

// GET /api/projects/[id]: totals, by category, by month, transactions, suggestions
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);
    const id = await projectId(context);
    if (id === null) return notFound();
    const detail = await getProjectDetail(userId, id);
    if (!detail) return notFound();
    return NextResponse.json({ data: detail, success: true });
  } catch (error) {
    return errorResponse(error, "GET /api/projects/[id]", "Failed to fetch project");
  }
}

// PUT /api/projects/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);
    const id = await projectId(context);
    if (id === null) return notFound();

    const existing = await db
      .select()
      .from(schema.projects)
      .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)))
      .get();
    if (!existing) return notFound();

    const parsed = await parseProjectInput(userId, await request.json(), true);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error, success: false }, { status: 400 });
    }
    const { values } = parsed;
    const start = values.startDate ?? existing.startDate;
    const end = values.endDate !== undefined ? values.endDate : existing.endDate;
    if (!isValidWindow(start, end)) {
      return NextResponse.json({ error: "End date must be on or after the start date", success: false }, { status: 400 });
    }

    await db
      .update(schema.projects)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)));

    return NextResponse.json({ data: { updated: true }, success: true });
  } catch (error) {
    return errorResponse(error, "PUT /api/projects/[id]", "Failed to update project");
  }
}

// DELETE /api/projects/[id]: transactions keep their category, only the project link is cleared
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireAuth(request);
    const id = await projectId(context);
    if (id === null) return notFound();

    const cleared = db.transaction((tx) => {
      const existing = tx
        .select({ id: schema.projects.id })
        .from(schema.projects)
        .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)))
        .get();
      if (!existing) return null;
      const result = tx
        .update(schema.transactions)
        .set({ projectId: null })
        .where(and(eq(schema.transactions.projectId, id), eq(schema.transactions.userId, userId)))
        .run();
      tx.delete(schema.projects).where(eq(schema.projects.id, id)).run();
      return result.changes;
    });
    if (cleared === null) return notFound();

    return NextResponse.json({ data: { deleted: true, transactionsCleared: cleared }, success: true });
  } catch (error) {
    return errorResponse(error, "DELETE /api/projects/[id]", "Failed to delete project");
  }
}
