import { invalidatePortfolio } from "@/hooks/use-database";

/**
 * Pull fresh balances for one Plaid item (bank) right after it is linked or
 * re-authenticated, then refresh today's snapshot so net worth reflects them.
 * Failures are logged, not thrown: the connection itself already succeeded.
 */
export async function syncItemBalances(itemId: number): Promise<number> {
  try {
    const response = await fetch("/api/plaid/balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });

    if (!response.ok) {
      console.error("Balance sync after Plaid link failed:", await response.text());
      return 0;
    }

    const data = await response.json();
    const accountsUpdated: number = data.accountsUpdated || 0;

    if (accountsUpdated > 0) {
      await fetch("/api/portfolio/snapshots/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipSync: true }),
      }).catch((error) => console.error("Snapshot update after Plaid link failed:", error));
    }

    return accountsUpdated;
  } catch (error) {
    console.error("Balance sync after Plaid link failed:", error);
    return 0;
  } finally {
    invalidatePortfolio();
  }
}
