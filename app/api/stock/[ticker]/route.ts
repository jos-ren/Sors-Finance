import { NextRequest, NextResponse } from 'next/server';
import { getStockQuote, QuoteError } from '@/lib/services/quotes';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const quote = await getStockQuote(ticker);
    return NextResponse.json(quote);
  } catch (error) {
    if (error instanceof QuoteError) {
      return NextResponse.json(
        { error: error.message, ...(error.code ? { code: error.code } : {}) },
        { status: error.status }
      );
    }

    console.error('Stock API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock data' },
      { status: 500 }
    );
  }
}
