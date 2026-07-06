/**
 * API Route: System Logs (Error Log)
 * GET /api/system-logs - List log entries (paginated, newest first)
 * DELETE /api/system-logs - Clear all log entries visible to the user
 *
 * Returns the user's own entries plus system-wide entries (userId = null),
 * e.g. scheduler initialization failures.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { db, schema } from "@/lib/db/connection";
import { eq, or, isNull, and, desc, count, type SQL } from "drizzle-orm";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
    );
    const level = searchParams.get("level"); // optional: 'info' | 'warning' | 'error'

    const visibleToUser = or(
      eq(schema.systemLogs.userId, userId),
      isNull(schema.systemLogs.userId)
    );

    const filters: SQL | undefined =
      level && ["info", "warning", "error"].includes(level)
        ? and(visibleToUser, eq(schema.systemLogs.level, level))
        : visibleToUser;

    const [logs, totalResult] = await Promise.all([
      db
        .select()
        .from(schema.systemLogs)
        .where(filters)
        .orderBy(desc(schema.systemLogs.createdAt), desc(schema.systemLogs.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ total: count() }).from(schema.systemLogs).where(filters),
    ]);

    return NextResponse.json({
      data: {
        logs,
        total: totalResult[0]?.total ?? 0,
        page,
        pageSize,
      },
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/system-logs error:", error);
    return NextResponse.json(
      { error: "Failed to fetch system logs", success: false },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    await db
      .delete(schema.systemLogs)
      .where(
        or(
          eq(schema.systemLogs.userId, userId),
          isNull(schema.systemLogs.userId)
        )
      );

    return NextResponse.json({ data: { cleared: true }, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    console.error("DELETE /api/system-logs error:", error);
    return NextResponse.json(
      { error: "Failed to clear system logs", success: false },
      { status: 500 }
    );
  }
}
