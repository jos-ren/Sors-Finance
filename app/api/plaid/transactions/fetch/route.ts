/**
 * API Route: Fetch transactions from Plaid
 * POST /api/plaid/transactions/fetch
 *
 * Fetches settled transactions for the selected accounts and date range and
 * sorts them three ways:
 *   - already imported (Plaid id stored)      → counted, dropped
 *   - imported before Plaid ids were stored  → returned as `enrichments` so
 *     the client can backfill details and fix the date on the existing row
 *   - new                                     → returned for the import pipeline
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/connection";
import { plaidItems, plaidAccounts, transactions as transactionsTable } from "@/lib/db/schema";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { createPlaidClient, isPlaidConfigured } from "@/lib/plaid/client";
import { requireAuth, AuthError } from "@/lib/auth/api-helper";
import { statusForPlaidError } from "@/lib/plaid/health";
import type {
  FetchPlaidTransactionsRequest,
  FetchedPlaidTransaction,
  PlaidEnrichment,
  PlaidTransactionFields,
} from "@/lib/plaid/types";
import type { TransactionDetails } from "@/lib/db/types";
import { Transaction as PlaidTransaction, TransactionsGetRequest } from "plaid";

/** Plaid sends midnight when the bank has no real time; treat that as unknown. */
function realTime(iso: string | null | undefined): string | null {
  if (!iso || /T00:00:00(\.0+)?(Z|[+-]00:?00)?$/.test(iso)) return null;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

/** Case-insensitive unique, non-empty strings in order. */
function uniqueParts(parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const text = p?.trim();
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
  }
  return out;
}

function toFields(t: PlaidTransaction): PlaidTransactionFields {
  // The clean merchant stays the display name (and the legacy dedup key);
  // keyword rules see every variant, so "AMZN Mktp" or "PRIME VIDEO" can match.
  const description = t.merchant_name || t.name || "Unknown";
  const pfc = t.personal_finance_category;
  const details: TransactionDetails = {
    plaidCategory: pfc
      ? { primary: pfc.primary, detailed: pfc.detailed, confidence: pfc.confidence_level ?? null }
      : null,
    paymentChannel: t.payment_channel ?? null,
    city: t.location?.city ?? null,
    region: t.location?.region ?? null,
    website: t.website ?? null,
    authorizedDate: t.authorized_date ?? null,
    postedDate: t.date,
    plaidAccountId: t.account_id,
  };
  return {
    plaidTransactionId: t.transaction_id,
    description,
    matchField: uniqueParts([description, t.name, t.original_description]).join(" "),
    originalDescription: t.original_description ?? null,
    merchantName: t.merchant_name ?? null,
    transactedAt: realTime(t.authorized_datetime) ?? realTime(t.datetime),
    details,
  };
}

/** Legacy imports stored `new Date("YYYY-MM-DD")`, i.e. UTC midnight of the posted date. */
function legacyKey(description: string, amountOut: number, amountIn: number, ms: number): string {
  return `${description}|${amountOut}|${amountIn}|${ms}`;
}

export async function POST(request: NextRequest) {
  let plaidItemId: number | null = null;
  try {
    const { userId } = await requireAuth(request);
    const body: FetchPlaidTransactionsRequest = await request.json();
    const { itemId, accountIds, startDate, endDate } = body;

    if (!itemId || !accountIds || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (accountIds.length === 0) {
      return NextResponse.json({ error: "At least one account must be selected" }, { status: 400 });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 });
    }

    const [plaidItem] = await db
      .select()
      .from(plaidItems)
      .where(and(eq(plaidItems.id, itemId), eq(plaidItems.userId, userId)))
      .limit(1);

    if (!plaidItem) {
      return NextResponse.json({ error: "Plaid item not found" }, { status: 404 });
    }
    plaidItemId = plaidItem.id;

    if (!isPlaidConfigured()) {
      return NextResponse.json(
        { error: "Plaid credentials not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET in your .env file." },
        { status: 400 }
      );
    }

    const client = createPlaidClient(plaidItem.environment as "sandbox" | "production");

    const plaidRequest: TransactionsGetRequest = {
      access_token: plaidItem.accessToken,
      start_date: startDate,
      end_date: endDate,
      options: {
        account_ids: accountIds,
        count: 500, // Max per request
        offset: 0,
        include_original_description: true,
        include_personal_finance_category: true,
      },
    };

    let allTransactions: PlaidTransaction[] = [];
    let totalTransactions = 0;

    // Paginate through all transactions
    do {
      const response = await client.transactionsGet(plaidRequest);
      allTransactions = allTransactions.concat(response.data.transactions);
      totalTransactions = response.data.total_transactions;
      plaidRequest.options!.offset = allTransactions.length;
    } while (allTransactions.length < totalTransactions);

    const accountsData = await db
      .select()
      .from(plaidAccounts)
      .where(eq(plaidAccounts.plaidItemId, itemId));
    const accountMap = new Map(accountsData.map((acc) => [acc.accountId, acc.name]));

    // Rows this user already has from Plaid (by id), and older Plaid rows from
    // this bank without an id that can be matched up and backfilled.
    const existingIds = new Set(
      (
        await db
          .select({ plaidTransactionId: transactionsTable.plaidTransactionId })
          .from(transactionsTable)
          .where(and(eq(transactionsTable.userId, userId), isNotNull(transactionsTable.plaidTransactionId)))
      ).map((r) => r.plaidTransactionId!)
    );

    const legacyRows = await db
      .select({
        id: transactionsTable.id,
        date: transactionsTable.date,
        description: transactionsTable.description,
        amountOut: transactionsTable.amountOut,
        amountIn: transactionsTable.amountIn,
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.sourceMethod, "Plaid"),
          eq(transactionsTable.source, plaidItem.institutionName),
          isNull(transactionsTable.plaidTransactionId)
        )
      );
    const legacyByKey = new Map<string, number[]>();
    for (const r of legacyRows) {
      const key = legacyKey(r.description, r.amountOut, r.amountIn, r.date.getTime());
      legacyByKey.set(key, [...(legacyByKey.get(key) ?? []), r.id]);
    }

    const settled = allTransactions.filter((t) => !t.pending);
    const newTransactions: FetchedPlaidTransaction[] = [];
    const enrichments: PlaidEnrichment[] = [];
    let alreadyImported = 0;

    for (const t of settled) {
      if (existingIds.has(t.transaction_id)) {
        alreadyImported++;
        continue;
      }

      const isIncome = t.amount < 0; // Plaid uses negative for money in
      const absAmount = Math.abs(t.amount);
      const amountOut = isIncome ? 0 : absAmount;
      const amountIn = isIncome ? absAmount : 0;
      const fields = toFields(t);
      // The day the purchase was made reads better than the day it posted
      const day = t.authorized_date ?? t.date;

      const legacyIds = legacyByKey.get(
        legacyKey(fields.description, amountOut, amountIn, new Date(t.date).getTime())
      );
      const legacyId = legacyIds?.shift();
      if (legacyId != null) {
        enrichments.push({ id: legacyId, day, ...fields });
        continue;
      }

      newTransactions.push({
        ...fields,
        day,
        amountOut,
        amountIn,
        netAmount: amountIn - amountOut,
        source: plaidItem.institutionName,
        sourceMethod: "Plaid",
        sourceAccountName: accountMap.get(t.account_id) || "Unknown Account",
      });
    }

    return NextResponse.json({
      success: true,
      transactions: newTransactions,
      enrichments,
      alreadyImported,
      totalFetched: allTransactions.length,
      settledCount: settled.length,
      pendingCount: allTransactions.length - settled.length,
      institutionName: plaidItem.institutionName,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching Plaid transactions:", error);

    // Handle Plaid-specific errors
    const err = error as { response?: { data?: { error_message?: string; error_code?: string } }; message?: string };
    if (err.response?.data) {
      const plaidError = err.response.data;

      // Flag the connection so Settings → Plaid shows its Reconnect button (Link update mode)
      if (statusForPlaidError(plaidError.error_code) === "login_required" && plaidItemId != null) {
        await db
          .update(plaidItems)
          .set({ status: "login_required", errorMessage: plaidError.error_message ?? null, updatedAt: new Date() })
          .where(eq(plaidItems.id, plaidItemId))
          .catch(() => undefined);
      }

      return NextResponse.json(
        {
          error: `Plaid error: ${plaidError.error_message || "Unknown error"}`,
          errorCode: plaidError.error_code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: err.message || "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
