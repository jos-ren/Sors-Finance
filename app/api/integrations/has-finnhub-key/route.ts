import { NextResponse } from "next/server";

export async function GET() {
  const hasKey = !!process.env.FINNHUB_API_KEY && process.env.FINNHUB_API_KEY.trim().length > 0;
  
  return NextResponse.json({ hasKey });
}
