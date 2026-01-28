/**
 * API Route: Fetch transactions from Plaid
 * POST /api/plaid/transactions/fetch
 *
 * Fetches transactions from Plaid for specified accounts and date range.
 * Returns data in the app's Transaction format for categorization flow.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/connection";
import { plaidItems, plaidAccounts, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createPlaidClient } from "@/lib/plaid/client";
import { decrypt } from "@/lib/encryption";
import type { FetchPlaidTransactionsRequest, PlaidCredentials } from "@/lib/plaid/types";
import { TransactionsGetRequest, TransactionsGetResponse } from "plaid";
import { PLAID_SETTINGS_KEYS } from "@/lib/plaid/types";

// Generate unique IDs safely
let idCounter = 0;
function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `temp-${Date.now()}-${++idCounter}`;
}

export async function POST(request: NextRequest) {
  try {
    const body: FetchPlaidTransactionsRequest = await request.json();
    const { itemId, accountIds, startDate, endDate } = body;

    if (!itemId || !accountIds || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (accountIds.length === 0) {
      return NextResponse.json(
        { error: "At least one account must be selected" },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Get the Plaid item
    const item = await db
      .select()
      .from(plaidItems)
      .where(eq(plaidItems.id, itemId))
      .limit(1);

    if (!item || item.length === 0) {
      return NextResponse.json(
        { error: "Plaid item not found" },
        { status: 404 }
      );
    }

    const plaidItem = item[0];

    // Decrypt access token
    const accessToken = decrypt(plaidItem.accessToken);

    // Get Plaid credentials from settings
    const credentialsRows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, PLAID_SETTINGS_KEYS.CLIENT_ID));

    if (!credentialsRows || credentialsRows.length === 0) {
      return NextResponse.json(
        { error: "Plaid credentials not configured" },
        { status: 400 }
      );
    }

    const secretRows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, PLAID_SETTINGS_KEYS.SECRET));

    if (!secretRows || secretRows.length === 0) {
      return NextResponse.json(
        { error: "Plaid credentials not configured" },
        { status: 400 }
      );
    }

    // Decrypt credentials
    const clientId = decrypt(credentialsRows[0].value);
    const secret = decrypt(secretRows[0].value);

    const credentials: PlaidCredentials = {
      clientId,
      secret,
      environment: plaidItem.environment as "sandbox" | "development" | "production",
    };

    // Get Plaid client
    const client = createPlaidClient(credentials);

    // Fetch transactions from Plaid
    const plaidRequest: TransactionsGetRequest = {
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: {
        account_ids: accountIds,
        count: 500, // Max per request
        offset: 0,
      },
    };

    let allTransactions: TransactionsGetResponse["transactions"] = [];
    let totalTransactions = 0;

    // Paginate through all transactions
    do {
      const response = await client.transactionsGet(plaidRequest);
      allTransactions = allTransactions.concat(response.data.transactions);
      totalTransactions = response.data.total_transactions;
      plaidRequest.options!.offset = allTransactions.length;
    } while (allTransactions.length < totalTransactions);

    // Get account names for source labeling
    const accountsData = await db
      .select()
      .from(plaidAccounts)
      .where(eq(plaidAccounts.plaidItemId, itemId));

    const accountMap = new Map(
      accountsData.map((acc) => [acc.accountId, acc.name])
    );

    // Transform Plaid transactions to app format
    const transformedTransactions = allTransactions.map((t) => {
      const accountName = accountMap.get(t.account_id) || "Unknown Account";
      const isIncome = t.amount < 0; // Plaid uses negative for income
      const absAmount = Math.abs(t.amount);
      const amountOut = isIncome ? 0 : absAmount;
      const amountIn = isIncome ? absAmount : 0;
      const description = t.merchant_name || t.name || "Unknown";

      return {
        id: generateId(),
        date: new Date(t.date),
        description,
        matchField: description.toLowerCase(), // For keyword matching
        amountOut,
        amountIn,
        netAmount: amountIn - amountOut,
        source: `Plaid - ${plaidItem.institutionName} (${accountName})`,
        categoryId: null,
        isConflict: false,
        plaidTransactionId: t.transaction_id,
        plaidAccountId: t.account_id,
        pending: t.pending,
      };
    });

    // Filter out pending transactions by default
    const settledTransactions = transformedTransactions.filter(t => !t.pending);

    return NextResponse.json({
      success: true,
      transactions: settledTransactions,
      totalFetched: allTransactions.length,
      settledCount: settledTransactions.length,
      pendingCount: allTransactions.length - settledTransactions.length,
      institutionName: plaidItem.institutionName,
    });
  } catch (error: any) {
    console.error("Error fetching Plaid transactions:", error);

    // Handle Plaid-specific errors
    if (error.response?.data) {
      const plaidError = error.response.data;
      return NextResponse.json(
        {
          error: `Plaid error: ${plaidError.error_message || "Unknown error"}`,
          errorCode: plaidError.error_code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
