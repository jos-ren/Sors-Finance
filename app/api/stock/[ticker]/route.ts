import { NextRequest, NextResponse } from 'next/server';

interface FinnhubQuote {
  c: number;  // Current price
  d: number;  // Change
  dp: number; // Percent change
  h: number;  // High price of the day
  l: number;  // Low price of the day
  o: number;  // Open price of the day
  pc: number; // Previous close price
  t: number;  // Timestamp
}

interface FinnhubProfile {
  name: string;
  ticker: string;
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  marketCapitalization: number;
  shareOutstanding: number;
  logo: string;
  phone: string;
  weburl: string;
  finnhubIndustry: string;
}

interface YahooQuoteResult {
  meta: {
    currency: string;
    symbol: string;
    regularMarketPrice: number;
    previousClose: number;
    shortName?: string;
    longName?: string;
  };
}

// Fallback to Yahoo Finance for international stocks
async function fetchFromYahoo(ticker: string) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }
  );

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    }
    throw new Error(`Yahoo API error: ${response.status}`);
  }

  const data = await response.json();
  const result = data.chart?.result?.[0] as YahooQuoteResult | undefined;

  if (!result?.meta) {
    throw new Error('Ticker not found');
  }

  const meta = result.meta;
  const previousClose = meta.previousClose || 0;
  const currentPrice = meta.regularMarketPrice;
  const changePercent = previousClose > 0
    ? ((currentPrice - previousClose) / previousClose) * 100
    : 0;

  return {
    ticker: meta.symbol,
    price: currentPrice,
    currency: meta.currency || 'USD',
    name: meta.longName || meta.shortName || meta.symbol,
    change: changePercent,
    previousClose,
    marketState: 'open',
    isInternational: true,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const apiKey = request.headers.get('x-finnhub-key');

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker is required' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured', code: 'NO_API_KEY' },
        { status: 401 }
      );
    }

    const upperTicker = ticker.toUpperCase();
    const encodedTicker = encodeURIComponent(upperTicker);

    // Fetch quote and profile in parallel
    const [quoteResponse, profileResponse] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${encodedTicker}&token=${apiKey}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodedTicker}&token=${apiKey}`),
    ]);

    if (quoteResponse.status === 401) {
      return NextResponse.json(
        { error: 'Invalid API key', code: 'INVALID_API_KEY' },
        { status: 401 }
      );
    }

    if (quoteResponse.status === 429 || profileResponse.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.', code: 'RATE_LIMIT' },
        { status: 429 }
      );
    }

    // Finnhub 403 = international stock, fallback to Yahoo
    if (quoteResponse.status === 403) {
      console.log(`Finnhub 403 for ${upperTicker}, falling back to Yahoo Finance`);
      try {
        const yahooData = await fetchFromYahoo(upperTicker);
        return NextResponse.json(yahooData);
      } catch (yahooError) {
        console.error('Yahoo fallback failed:', yahooError);
        if (yahooError instanceof Error && yahooError.message === 'RATE_LIMIT') {
          return NextResponse.json(
            { error: 'Rate limit exceeded. Try again later.', code: 'RATE_LIMIT' },
            { status: 429 }
          );
        }
        return NextResponse.json(
          { error: 'Failed to fetch international stock data' },
          { status: 500 }
        );
      }
    }

    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      console.error('Finnhub quote error:', quoteResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch stock data' },
        { status: 500 }
      );
    }

    let quote: FinnhubQuote;
    try {
      quote = await quoteResponse.json();
    } catch (parseError) {
      console.error('Failed to parse quote response:', parseError);
      return NextResponse.json(
        { error: 'Invalid response from stock API' },
        { status: 500 }
      );
    }

    // Finnhub returns 0 for all values if ticker not found
    if (quote.c === 0 && quote.pc === 0 && quote.t === 0) {
      return NextResponse.json(
        { error: 'Ticker not found' },
        { status: 404 }
      );
    }

    // Try to get company profile for the name
    let companyName = upperTicker;
    let currency = 'USD';

    if (profileResponse.ok) {
      try {
        const profile: FinnhubProfile = await profileResponse.json();
        if (profile.name) {
          companyName = profile.name;
        }
        if (profile.currency) {
          currency = profile.currency;
        }
      } catch {
        // Profile parsing failed, use defaults
        console.warn('Failed to parse profile for', upperTicker);
      }
    }

    return NextResponse.json({
      ticker: upperTicker,
      price: quote.c,
      currency,
      name: companyName,
      change: quote.dp,
      previousClose: quote.pc,
      marketState: 'open',
      isInternational: false,
    });
  } catch (error) {
    console.error('Stock API error:', error);

    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }

    return NextResponse.json(
      { error: 'Failed to fetch stock data' },
      { status: 500 }
    );
  }
}
