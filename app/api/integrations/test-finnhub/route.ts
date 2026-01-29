/**
 * API Route: Test Finnhub API Key
 * GET /api/integrations/test-finnhub
 *
 * Tests if Finnhub API key is valid by making a simple API call
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-helper";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          error: "Finnhub API key not configured. Please set FINNHUB_API_KEY in your .env file."
        },
        { status: 400 }
      );
    }

    // Test the API key by fetching a simple quote (AAPL is always available)
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${apiKey}`
    );

    if (response.status === 401) {
      return NextResponse.json(
        {
          success: false,
          configured: true,
          error: "Invalid Finnhub API key. Please check your credentials."
        },
        { status: 401 }
      );
    }

    if (response.status === 429) {
      return NextResponse.json(
        {
          success: false,
          configured: true,
          error: "Finnhub API rate limit exceeded. Your key is valid but temporarily limited."
        },
        { status: 429 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          configured: true,
          error: `Finnhub API error: ${response.statusText}`
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Check if we got valid data back
    if (data && typeof data.c === 'number') {
      return NextResponse.json({
        success: true,
        configured: true,
        message: "Finnhub API key is valid and working"
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          configured: true,
          error: "Unexpected response from Finnhub API"
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Finnhub test error:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to test Finnhub API key"
      },
      { status: 500 }
    );
  }
}
