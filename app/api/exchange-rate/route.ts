import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRate, QuoteError } from '@/lib/services/quotes';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get('from')?.toUpperCase() || 'USD';
    const to = searchParams.get('to')?.toUpperCase() || 'CAD';

    const result = await getExchangeRate(from, to);

    // "same" source predates this refactor; keep the response shape stable
    if (result.source === 'same') {
      return NextResponse.json({ rate: 1, from: result.from, to: result.to });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof QuoteError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error('Exchange rate error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exchange rate' },
      { status: 500 }
    );
  }
}
