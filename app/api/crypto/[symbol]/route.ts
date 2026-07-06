import { NextRequest, NextResponse } from 'next/server';
import { getCryptoQuote, QuoteError } from '@/lib/services/quotes';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const quote = await getCryptoQuote(symbol);
    return NextResponse.json(quote);
  } catch (error) {
    if (error instanceof QuoteError) {
      return NextResponse.json(
        { error: error.message, ...(error.code ? { code: error.code } : {}) },
        { status: error.status }
      );
    }

    console.error('Crypto price error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch crypto data' },
      { status: 500 }
    );
  }
}
