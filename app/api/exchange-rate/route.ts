import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

// Create instance for v3
const yahooFinance = new YahooFinance();

// Cache exchange rates for 1 hour
const rateCache = new Map<string, { rate: number; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get('from')?.toUpperCase() || 'USD';
    const to = searchParams.get('to')?.toUpperCase() || 'CAD';

    // Same currency, no conversion needed
    if (from === to) {
      return NextResponse.json({ rate: 1, from, to });
    }

    const cacheKey = `${from}${to}`;

    // Check cache
    const cached = rateCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        rate: cached.rate,
        from,
        to,
        cached: true,
      });
    }

    // Fetch from Yahoo Finance using currency pair format
    // e.g., USDCAD=X for USD to CAD
    const ticker = `${from}${to}=X`;
    const quote = await yahooFinance.quote(ticker);

    if (!quote || quote.regularMarketPrice === undefined) {
      // Try reverse pair and invert
      const reverseTicker = `${to}${from}=X`;
      const reverseQuote = await yahooFinance.quote(reverseTicker);

      if (reverseQuote && reverseQuote.regularMarketPrice) {
        const rate = 1 / reverseQuote.regularMarketPrice;
        rateCache.set(cacheKey, { rate, timestamp: Date.now() });
        return NextResponse.json({ rate, from, to });
      }

      return NextResponse.json(
        { error: 'Exchange rate not found' },
        { status: 404 }
      );
    }

    const rate = quote.regularMarketPrice;

    // Cache the result
    rateCache.set(cacheKey, { rate, timestamp: Date.now() });

    return NextResponse.json({ rate, from, to });
  } catch (error) {
    console.error('Exchange rate error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exchange rate' },
      { status: 500 }
    );
  }
}
