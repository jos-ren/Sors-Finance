import { NextRequest, NextResponse } from 'next/server';

// Precious metals available via gold-api.com
const PRECIOUS_METALS = [
  { symbol: 'XAU', displaySymbol: 'XAU', name: 'Gold', type: 'Metal' },
  { symbol: 'XAG', displaySymbol: 'XAG', name: 'Silver', type: 'Metal' },
  { symbol: 'XPT', displaySymbol: 'XPT', name: 'Platinum', type: 'Metal' },
  { symbol: 'XPD', displaySymbol: 'XPD', name: 'Palladium', type: 'Metal' },
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.toLowerCase() || '';

    // Filter metals by search query
    const results = PRECIOUS_METALS.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.displaySymbol.toLowerCase().includes(query)
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Precious metals search error:', error);
    return NextResponse.json(
      { error: 'Failed to search precious metals' },
      { status: 500 }
    );
  }
}
