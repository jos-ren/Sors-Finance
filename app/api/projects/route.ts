import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db, schema } from "@/lib/db/connection";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { getProjectSummaries, isValidWindow, parseProjectInput } from "@/lib/projects/projects-db";

// GET /api/projects: every project with spent, status and fund totals
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const projects = await getProjectSummaries(userId);
    return NextResponse.json({ data: projects, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("GET /api/projects error:", error);
    return NextResponse.json({ error: "Failed to fetch projects", success: false }, { status: 500 });
  }
}

// POST /api/projects
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const parsed = await parseProjectInput(userId, await request.json(), false);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error, success: false }, { status: 400 });
    }
    const { values } = parsed;
    if (!isValidWindow(values.startDate!, values.endDate)) {
      return NextResponse.json({ error: "End date must be on or after the start date", success: false }, { status: 400 });
    }

    const now = new Date();
    const row = db
      .insert(schema.projects)
      .values({
        ...values,
        name: values.name!,
        startDate: values.startDate!,
        uuid: randomUUID(),
        userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: schema.projects.id })
      .get();

    return NextResponse.json({ data: { id: row.id }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, success: false }, { status: error.statusCode });
    }
    console.error("POST /api/projects error:", error);
    return NextResponse.json({ error: "Failed to create project", success: false }, { status: 500 });
  }
}
