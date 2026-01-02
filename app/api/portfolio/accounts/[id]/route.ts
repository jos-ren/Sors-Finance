import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/portfolio/accounts/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const accountId = parseInt(id, 10);

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: "Invalid account ID", success: false },
        { status: 400 }
      );
    }

    const result = await db
      .select()
      .from(schema.portfolioAccounts)
      .where(eq(schema.portfolioAccounts.id, accountId))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Account not found", success: false },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result[0], success: true });
  } catch (error) {
    console.error("GET /api/portfolio/accounts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch account", success: false },
      { status: 500 }
    );
  }
}

// PUT /api/portfolio/accounts/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const accountId = parseInt(id, 10);

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: "Invalid account ID", success: false },
        { status: 400 }
      );
    }

    const { name } = await request.json();
    const now = new Date();

    await db
      .update(schema.portfolioAccounts)
      .set({ name, updatedAt: now })
      .where(eq(schema.portfolioAccounts.id, accountId));

    return NextResponse.json({ data: { updated: true }, success: true });
  } catch (error) {
    console.error("PUT /api/portfolio/accounts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update account", success: false },
      { status: 500 }
    );
  }
}

// DELETE /api/portfolio/accounts/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const accountId = parseInt(id, 10);

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: "Invalid account ID", success: false },
        { status: 400 }
      );
    }

    // Delete items first (cascade)
    await db
      .delete(schema.portfolioItems)
      .where(eq(schema.portfolioItems.accountId, accountId));

    // Delete account
    await db
      .delete(schema.portfolioAccounts)
      .where(eq(schema.portfolioAccounts.id, accountId));

    return NextResponse.json({ data: { deleted: true }, success: true });
  } catch (error) {
    console.error("DELETE /api/portfolio/accounts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete account", success: false },
      { status: 500 }
    );
  }
}
