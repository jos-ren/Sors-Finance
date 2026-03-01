import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { currencyExchangeRates } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

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
    const now = Date.now();

    // Layer 1: Check in-memory cache (fastest)
    const memCached = rateCache.get(cacheKey);
    if (memCached && now - memCached.timestamp < MEMORY_CACHE_DURATION) {
      console.log(`[Exchange Rate] ${from}→${to}: MEMORY cache (${Math.floor((now - memCached.timestamp) / 1000)}s old)`);
      return NextResponse.json({
        rate: memCached.rate,
        from,
        to,
        source: 'memory',
      });
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
        return NextResponse.json({
          rate: dbRate.rate,
          from,
          to,
          source: 'database',
          age: Math.floor(age / 1000 / 60), // age in minutes
        });
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
      return NextResponse.json(
        { error: 'Exchange rate not found' },
        { status: 404 }
      );
    }

    const data: FrankfurterResponse = await response.json();

    if (!data.rates || data.rates[to] === undefined) {
      return NextResponse.json(
        { error: 'Exchange rate not found' },
        { status: 404 }
      );
    }

    const rate = data.rates[to];
    const timestamp = new Date();

    // Store in memory cache
    rateCache.set(cacheKey, { rate, timestamp: now });

    // Store/update in database
    if (dbRates.length > 0) {
      // Update existing
      await db
        .update(currencyExchangeRates)
        .set({ rate, updatedAt: timestamp })
        .where(eq(currencyExchangeRates.id, dbRates[0].id!));
      console.log(`[Exchange Rate] ${from}→${to}: Updated in database (rate: ${rate.toFixed(4)})`);
    } else {
      // Insert new
      await db.insert(currencyExchangeRates).values({
        fromCurrency: from,
        toCurrency: to,
        rate,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      console.log(`[Exchange Rate] ${from}→${to}: Saved to database (rate: ${rate.toFixed(4)})`);
    }

    return NextResponse.json({
      rate,
      from,
      to,
      source: 'api',
    });
  } catch (error) {
    console.error('Exchange rate error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exchange rate' },
      { status: 500 }
    );
  }
}
