/**
 * Client-side API wrapper for the manually-set expected monthly income.
 */

/** Returns the planned income amount for a month, or null if unset. */
export async function getPlannedIncome(year: number, month: number): Promise<number | null> {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  const res = await fetch(`/api/budgets/income?${params}`);
  if (!res.ok) throw new Error("Failed to fetch planned income");
  const { data } = await res.json();
  return data?.amount ?? null;
}

/** Upsert the planned income amount for a month. Returns the row id. */
export async function setPlannedIncome(year: number, month: number, amount: number): Promise<number> {
  const res = await fetch("/api/budgets/income", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year, month, amount }),
  });
  if (!res.ok) throw new Error("Failed to save planned income");
  const { data } = await res.json();
  return data.id;
}
