import { NextRequest, NextResponse } from 'next/server';

// Precious metals names
const METAL_NAMES: Record<string, string> = {
  'XAU': 'Gold',
  'XAG': 'Silver',
  'XPT': 'Platinum',
  'XPD': 'Palladium',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    const decodedSymbol = decodeURIComponent(symbol).toUpperCase();
    const metalName = METAL_NAMES[decodedSymbol];

    if (!metalName) {
      return NextResponse.json(
        { error: 'Unknown metal symbol' },
        { status: 404 }
      );
    }

    // Fetch from gold-api.com (free, no API key required)
    const response = await fetch(
      `https://api.gold-api.com/price/${decodedSymbol}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (response.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMIT' },
        { status: 429 }
      );
    }

    if (!response.ok) {
      console.error('Gold API error:', response.status, await response.text());
      return NextResponse.json(
        { error: 'Failed to fetch metal price' },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (!data.price) {
      return NextResponse.json(
        { error: 'Price data not available' },
        { status: 404 }
      );
    }

    // Gold API returns prices in USD - return as-is without conversion
    // The client will handle conversion to user's currency
    return NextResponse.json({
      ticker: decodedSymbol,
      price: data.price,
      currency: 'USD',
      name: metalName,
      change: data.change_percent || 0,
      previousClose: data.prev_close || data.price,
      isInternational: false,
    });
  } catch (error) {
    console.error('Metal price API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metal price' },
      { status: 500 }
    );
  }
}
