import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/connection";
import { desc } from "drizzle-orm";

// GET /api/imports
export async function GET() {
  try {
    const results = await db
      .select()
      .from(schema.imports)
      .orderBy(desc(schema.imports.importedAt));

    // Convert to match DbImport interface
    const imports = results.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      source: row.source,
      transactionCount: row.transactionCount,
      totalAmount: row.totalAmount,
      importedAt: row.importedAt,
    }));

    return NextResponse.json({ data: imports, success: true });
  } catch (error) {
    console.error("GET /api/imports error:", error);
    return NextResponse.json(
      { error: "Failed to fetch imports", success: false },
      { status: 500 }
    );
  }
}

// POST /api/imports
export async function POST(request: NextRequest) {
  try {
    const { fileName, source, transactionCount, totalAmount } = await request.json();

    if (!fileName || !source) {
      return NextResponse.json(
        { error: "fileName and source are required", success: false },
        { status: 400 }
      );
    }

    const result = await db
      .insert(schema.imports)
      .values({
        fileName,
        source,
        transactionCount: transactionCount ?? 0,
        totalAmount: totalAmount ?? 0,
        importedAt: new Date(),
      })
      .returning({ id: schema.imports.id });

    return NextResponse.json({ data: { id: result[0].id }, success: true });
  } catch (error) {
    console.error("POST /api/imports error:", error);
    return NextResponse.json(
      { error: "Failed to create import", success: false },
      { status: 500 }
    );
  }
}
