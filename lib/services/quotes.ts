/**
 * Quote Services
 *
 * Server-side price lookups for stocks (Finnhub + Yahoo fallback), crypto
 * (CoinGecko), precious metals (gold-api.com), and currency exchange rates
 * (Frankfurter with in-memory + database caching).
 *
 * These are plain functions so both API routes and background jobs (the
 * snapshot scheduler) can call them directly. The scheduler previously
 * fetched its own API routes over HTTP, which the auth middleware rejected
 * with 401 because background jobs have no session cookie.
 */

import { db } from '@/lib/db/connection';
import { currencyExchangeRates } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { symbolToCoingeckoId, symbolToName } from './crypto-symbols';

/**
 * Error with an HTTP-compatible status so API routes can pass it through.
 */
export class QuoteError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'QuoteError';
    this.status = status;
    this.code = code;
  }
}

export interface Quote {
  ticker: string;
  price: number;
  currency: string;
  name: string;
  change: number;
  previousClose?: number;
  marketState?: string;
  isInternational?: boolean;
}

// ─── Stocks (Finnhub with Yahoo Finance fallback) ────────────────────────────

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
  currency: string;
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
async function fetchFromYahoo(ticker: string): Promise<Quote> {
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
      throw new QuoteError('Rate limit exceeded. Try again later.', 429, 'RATE_LIMIT');
    }
    throw new QuoteError(`Yahoo API error: ${response.status}`, 500);
  }

  const data = await response.json();
  const result = data.chart?.result?.[0] as YahooQuoteResult | undefined;

  if (!result?.meta) {
    throw new QuoteError('Ticker not found', 404);
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

export async function getStockQuote(ticker: string): Promise<Quote> {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!ticker) {
    throw new QuoteError('Ticker is required', 400);
  }

  if (!apiKey) {
    throw new QuoteError(
      'Finnhub API key not configured. Please set FINNHUB_API_KEY in your .env file.',
      401,
      'NO_API_KEY'
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
    throw new QuoteError('Invalid API key', 401, 'INVALID_API_KEY');
  }

  if (quoteResponse.status === 429 || profileResponse.status === 429) {
    throw new QuoteError('Rate limit exceeded. Try again later.', 429, 'RATE_LIMIT');
  }

  // Finnhub 403 = international stock, fallback to Yahoo
  if (quoteResponse.status === 403) {
    console.log(`Finnhub 403 for ${upperTicker}, falling back to Yahoo Finance`);
    try {
      return await fetchFromYahoo(upperTicker);
    } catch (yahooError) {
      console.error('Yahoo fallback failed:', yahooError);
      if (yahooError instanceof QuoteError) throw yahooError;
      throw new QuoteError('Failed to fetch international stock data', 500);
    }
  }

  if (!quoteResponse.ok) {
    const errorText = await quoteResponse.text();
    console.error('Finnhub quote error:', quoteResponse.status, errorText);
    throw new QuoteError('Failed to fetch stock data', 500);
  }

  let quote: FinnhubQuote;
  try {
    quote = await quoteResponse.json();
  } catch (parseError) {
    console.error('Failed to parse quote response:', parseError);
    throw new QuoteError('Invalid response from stock API', 500);
  }

  // Finnhub returns 0 for all values if ticker not found
  if (quote.c === 0 && quote.pc === 0 && quote.t === 0) {
    throw new QuoteError('Ticker not found', 404);
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

  return {
    ticker: upperTicker,
    price: quote.c,
    currency,
    name: companyName,
    change: quote.dp,
    previousClose: quote.pc,
    marketState: 'open',
    isInternational: false,
  };
}

// ─── Crypto (CoinGecko) ───────────────────────────────────────────────────────

export interface CryptoQuote extends Quote {
  symbol: string;
  displaySymbol: string;
}

export async function getCryptoQuote(symbol: string): Promise<CryptoQuote> {
  if (!symbol) {
    throw new QuoteError('Symbol is required', 400);
  }

  // Extract base symbol from Binance format (e.g., "BINANCE:BTCUSDT" -> "BTC")
  const displaySymbol = symbol.split(':')[1] || symbol;
  const baseSymbol = displaySymbol.replace(/USDT$|USD$|BUSD$/, '');

  const coingeckoId = symbolToCoingeckoId[baseSymbol];
  if (!coingeckoId) {
    throw new QuoteError(`Unknown crypto symbol: ${baseSymbol}`, 404);
  }

  // Fetch price from CoinGecko (free, no API key needed)
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_24hr_change=true`,
    {
      headers: {
        'Accept': 'application/json',
      },
    }
  );

  if (response.status === 429) {
    throw new QuoteError('Rate limit exceeded. Try again in a minute.', 429, 'RATE_LIMIT');
  }

  if (!response.ok) {
    console.error('CoinGecko error:', response.status, await response.text());
    throw new QuoteError('Failed to fetch crypto price', 500);
  }

  const data = await response.json();
  const coinData = data[coingeckoId];

  if (!coinData || coinData.usd === undefined) {
    throw new QuoteError('Crypto price not available', 404);
  }

  return {
    symbol,
    displaySymbol,
    ticker: displaySymbol,
    price: coinData.usd,
    currency: 'USD',
    name: symbolToName[baseSymbol] || baseSymbol,
    change: coinData.usd_24h_change || 0,
  };
}

// ─── Precious Metals (gold-api.com) ──────────────────────────────────────────

const METAL_NAMES: Record<string, string> = {
  'XAU': 'Gold',
  'XAG': 'Silver',
  'XPT': 'Platinum',
  'XPD': 'Palladium',
};

export async function getMetalQuote(symbol: string): Promise<Quote> {
  if (!symbol) {
    throw new QuoteError('Symbol is required', 400);
  }

  const upperSymbol = symbol.toUpperCase();
  const metalName = METAL_NAMES[upperSymbol];

  if (!metalName) {
    throw new QuoteError('Unknown metal symbol', 404);
  }

  // Fetch from gold-api.com (free, no API key required)
  const response = await fetch(
    `https://api.gold-api.com/price/${upperSymbol}`,
    {
      headers: {
        'Accept': 'application/json',
      },
    }
  );

  if (response.status === 429) {
    throw new QuoteError('Rate limit exceeded', 429, 'RATE_LIMIT');
  }

  if (!response.ok) {
    console.error('Gold API error:', response.status, await response.text());
    throw new QuoteError('Failed to fetch metal price', 500);
  }

  const data = await response.json();

  if (!data.price) {
    throw new QuoteError('Price data not available', 404);
  }

  // Gold API returns prices in USD - return as-is without conversion
  return {
    ticker: upperSymbol,
    price: data.price,
    currency: 'USD',
    name: metalName,
    change: data.change_percent || 0,
    previousClose: data.prev_close || data.price,
    isInternational: false,
  };
}

// ─── Exchange Rates (Frankfurter, memory + DB cached) ────────────────────────

// In-memory cache as secondary layer (faster than DB)
const rateCache = new Map<string, { rate: number; timestamp: number }>();
const MEMORY_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in-memory
const DB_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in database

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface ExchangeRateResult {
  rate: number;
  from: string;
  to: string;
  source: 'same' | 'memory' | 'database' | 'api';
  age?: number; // age in minutes (database source only)
}

export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<ExchangeRateResult> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  // Same currency, no conversion needed
  if (from === to) {
    return { rate: 1, from, to, source: 'same' };
  }

  const cacheKey = `${from}${to}`;
  const now = Date.now();

  // Layer 1: Check in-memory cache (fastest)
  const memCached = rateCache.get(cacheKey);
  if (memCached && now - memCached.timestamp < MEMORY_CACHE_DURATION) {
    console.log(`[Exchange Rate] ${from}→${to}: MEMORY cache (${Math.floor((now - memCached.timestamp) / 1000)}s old)`);
    return { rate: memCached.rate, from, to, source: 'memory' };
  }

  // Layer 2: Check database cache (persistent, 24 hour)
  const dbRates = await db
    .select()
    .from(currencyExchangeRates)
    .where(
      and(
        eq(currencyExchangeRates.fromCurrency, from),
        eq(currencyExchangeRates.toCurrency, to)
      )
    )
    .limit(1);

  if (dbRates.length > 0) {
    const dbRate = dbRates[0];
    const age = now - dbRate.updatedAt.getTime();

    // If rate is less than 24 hours old, use it
    if (age < DB_CACHE_DURATION) {
      // Store in memory cache for faster subsequent access
      rateCache.set(cacheKey, { rate: dbRate.rate, timestamp: now });

      console.log(`[Exchange Rate] ${from}→${to}: DATABASE cache (${Math.floor(age / 1000 / 60)} min old)`);
      return {
        rate: dbRate.rate,
        from,
        to,
        source: 'database',
        age: Math.floor(age / 1000 / 60),
      };
    }
  }

  // Layer 3: Fetch from API (rate is missing or >24 hours old)
  console.log(`[Exchange Rate] ${from}→${to}: Fetching from API...`);
  const response = await fetch(
    `https://api.frankfurter.app/latest?from=${from}&to=${to}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Frankfurter API error:', errorText);
    throw new QuoteError('Exchange rate not found', 404);
  }

  const data: FrankfurterResponse = await response.json();

  if (!data.rates || data.rates[to] === undefined) {
    throw new QuoteError('Exchange rate not found', 404);
  }

  const rate = data.rates[to];
  const timestamp = new Date();

  // Store in memory cache
  rateCache.set(cacheKey, { rate, timestamp: now });

  // Store/update in database
  if (dbRates.length > 0) {
    await db
      .update(currencyExchangeRates)
      .set({ rate, updatedAt: timestamp })
      .where(eq(currencyExchangeRates.id, dbRates[0].id!));
    console.log(`[Exchange Rate] ${from}→${to}: Updated in database (rate: ${rate.toFixed(4)})`);
  } else {
    await db.insert(currencyExchangeRates).values({
      fromCurrency: from,
      toCurrency: to,
      rate,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    console.log(`[Exchange Rate] ${from}→${to}: Saved to database (rate: ${rate.toFixed(4)})`);
  }

  return { rate, from, to, source: 'api' };
}

/**
 * Convenience wrapper: returns just the numeric rate, falling back to 1 on
 * any failure (matching the previous silent-fallback behavior of callers).
 */
export async function getExchangeRateValue(
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  try {
    const result = await getExchangeRate(fromCurrency, toCurrency);
    return result.rate;
  } catch (error) {
    console.error(
      `[Exchange Rate] Failed to get ${fromCurrency}→${toCurrency}, falling back to 1:`,
      error
    );
    return 1;
  }
}
