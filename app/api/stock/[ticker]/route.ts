import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

// Create instance for v3
const yahooFinance = new YahooFinance();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker is required' },
        { status: 400 }
      );
    }

    // Fetch quote from Yahoo Finance
    const quote = await yahooFinance.quote(ticker.toUpperCase());

    if (!quote || quote.regularMarketPrice === undefined) {
      return NextResponse.json(
        { error: 'Ticker not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ticker: quote.symbol,
      price: quote.regularMarketPrice,
      currency: quote.currency || 'USD',
      name: quote.shortName || quote.longName || ticker,
      change: quote.regularMarketChangePercent || 0,
      previousClose: quote.regularMarketPreviousClose,
      marketState: quote.marketState,
    });
  } catch (error) {
    console.error('Yahoo Finance error:', error);

    // Handle specific errors
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);

      if (error.message.includes('not found') || error.message.includes('No data found')) {
        return NextResponse.json(
          { error: 'Ticker not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch stock data' },
      { status: 500 }
    );
  }
}
