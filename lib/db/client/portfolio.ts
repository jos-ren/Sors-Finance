/**
 * Client-side API wrapper for portfolio operations
 */

import type {
  DbPortfolioAccount,
  DbPortfolioItem,
  DbPortfolioSnapshot,
  BucketType,
  AddPortfolioItemData,
} from "../types";

// Account operations
export async function getPortfolioAccounts(bucket?: BucketType): Promise<DbPortfolioAccount[]> {
  const params = bucket ? `?bucket=${bucket}` : "";
  const res = await fetch(`/api/portfolio/accounts${params}`);
  if (!res.ok) throw new Error("Failed to fetch portfolio accounts");
  const { data } = await res.json();
  return data.map((a: DbPortfolioAccount) => ({
    ...a,
    createdAt: new Date(a.createdAt),
    updatedAt: new Date(a.updatedAt),
  }));
}

export async function getPortfolioAccountById(id: number): Promise<DbPortfolioAccount | null> {
  const res = await fetch(`/api/portfolio/accounts/${id}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch account");
  }
  const { data } = await res.json();
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

export async function addPortfolioAccount(bucket: BucketType, name: string): Promise<number> {
  const res = await fetch("/api/portfolio/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, name }),
  });
  if (!res.ok) throw new Error("Failed to create account");
  const { data } = await res.json();
  return data.id;
}

export async function updatePortfolioAccount(id: number, updates: { name: string }): Promise<void> {
  const res = await fetch(`/api/portfolio/accounts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update account");
}

export async function deletePortfolioAccount(id: number): Promise<void> {
  const res = await fetch(`/api/portfolio/accounts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete account");
}

export async function reorderPortfolioAccounts(
  bucket: BucketType,
  activeId: number,
  overId: number
): Promise<void> {
  const res = await fetch("/api/portfolio/accounts/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, activeId, overId }),
  });
  if (!res.ok) throw new Error("Failed to reorder accounts");
}

// Item operations
export async function getPortfolioItems(
  accountId?: number,
  includeInactive = false
): Promise<DbPortfolioItem[]> {
  const params = new URLSearchParams();
  if (accountId !== undefined) params.append("accountId", String(accountId));
  if (includeInactive) params.append("includeInactive", "true");

  const res = await fetch(`/api/portfolio/items?${params}`);
  if (!res.ok) throw new Error("Failed to fetch portfolio items");
  const { data } = await res.json();
  return data.map((i: DbPortfolioItem) => ({
    ...i,
    createdAt: new Date(i.createdAt),
    updatedAt: new Date(i.updatedAt),
    lastPriceUpdate: i.lastPriceUpdate ? new Date(i.lastPriceUpdate) : undefined,
  }));
}

export async function getPortfolioItemById(id: number): Promise<DbPortfolioItem | null> {
  const res = await fetch(`/api/portfolio/items/${id}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch item");
  }
  const { data } = await res.json();
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    lastPriceUpdate: data.lastPriceUpdate ? new Date(data.lastPriceUpdate) : undefined,
  };
}

export async function addPortfolioItem(itemData: AddPortfolioItemData): Promise<number> {
  const res = await fetch("/api/portfolio/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(itemData),
  });
  if (!res.ok) throw new Error("Failed to create item");
  const { data } = await res.json();
  return data.id;
}

export async function updatePortfolioItem(
  id: number,
  updates: Partial<Omit<DbPortfolioItem, "id" | "uuid" | "createdAt">>
): Promise<void> {
  const res = await fetch(`/api/portfolio/items/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update item");
}

export async function deletePortfolioItem(id: number, hard = false): Promise<void> {
  const params = hard ? "?hard=true" : "";
  const res = await fetch(`/api/portfolio/items/${id}${params}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete item");
}

export async function restorePortfolioItem(id: number): Promise<void> {
  const res = await fetch(`/api/portfolio/items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "restore" }),
  });
  if (!res.ok) throw new Error("Failed to restore item");
}

export async function reorderPortfolioItems(
  accountId: number,
  activeId: number,
  overId: number
): Promise<void> {
  const res = await fetch("/api/portfolio/items/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, activeId, overId }),
  });
  if (!res.ok) throw new Error("Failed to reorder items");
}

export async function getTickerModeItems(): Promise<DbPortfolioItem[]> {
  const res = await fetch("/api/portfolio/items?tickerMode=true");
  if (!res.ok) throw new Error("Failed to fetch ticker mode items");
  const { data } = await res.json();
  return data.map((i: DbPortfolioItem) => ({
    ...i,
    createdAt: new Date(i.createdAt),
    updatedAt: new Date(i.updatedAt),
    lastPriceUpdate: i.lastPriceUpdate ? new Date(i.lastPriceUpdate) : undefined,
  }));
}

// Snapshot operations
export async function getPortfolioSnapshots(options?: {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<DbPortfolioSnapshot[]> {
  const params = new URLSearchParams();
  if (options?.startDate) params.append("startDate", options.startDate.toISOString());
  if (options?.endDate) params.append("endDate", options.endDate.toISOString());
  if (options?.limit) params.append("limit", String(options.limit));

  const res = await fetch(`/api/portfolio/snapshots?${params}`);
  if (!res.ok) throw new Error("Failed to fetch snapshots");
  const { data } = await res.json();
  return data.map((s: DbPortfolioSnapshot) => ({
    ...s,
    date: new Date(s.date),
    createdAt: new Date(s.createdAt),
  }));
}

export async function getLatestPortfolioSnapshot(): Promise<DbPortfolioSnapshot | null> {
  const snapshots = await getPortfolioSnapshots({ limit: 1 });
  return snapshots.length > 0 ? snapshots[0] : null;
}

export async function createPortfolioSnapshot(): Promise<number> {
  const res = await fetch("/api/portfolio/snapshots", { method: "POST" });
  if (!res.ok) throw new Error("Failed to create snapshot");
  const { data } = await res.json();
  return data.id;
}

export async function deletePortfolioSnapshot(id: number): Promise<void> {
  const res = await fetch(`/api/portfolio/snapshots/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete snapshot");
}

export async function updatePortfolioSnapshot(
  id: number,
  updates: Partial<Pick<DbPortfolioSnapshot, "totalSavings" | "totalInvestments" | "totalAssets" | "totalDebt">>
): Promise<void> {
  const res = await fetch(`/api/portfolio/snapshots/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update snapshot");
}

export async function hasSnapshotToday(): Promise<boolean> {
  const res = await fetch("/api/portfolio/snapshots?today=true");
  if (!res.ok) throw new Error("Failed to check snapshot");
  const { exists } = await res.json();
  return exists;
}

export async function getTodaySnapshot(): Promise<DbPortfolioSnapshot | null> {
  const res = await fetch("/api/portfolio/snapshots?today=true");
  if (!res.ok) throw new Error("Failed to get today's snapshot");
  const { data } = await res.json();
  return data
    ? {
        ...data,
        date: new Date(data.date),
        createdAt: new Date(data.createdAt),
      }
    : null;
}

// Summary operations
export async function getNetWorthSummary(): Promise<{
  totalSavings: number;
  totalInvestments: number;
  totalAssets: number;
  totalDebt: number;
  netWorth: number;
}> {
  const res = await fetch("/api/portfolio/summary?type=netWorth");
  if (!res.ok) throw new Error("Failed to fetch net worth summary");
  const { data } = await res.json();
  return data;
}

export async function getBucketBreakdown(): Promise<Record<BucketType, number>> {
  const res = await fetch("/api/portfolio/summary?type=buckets");
  if (!res.ok) throw new Error("Failed to fetch bucket breakdown");
  const { data } = await res.json();
  return data;
}

export async function getBucketTotal(bucket: BucketType): Promise<number> {
  const res = await fetch(`/api/portfolio/summary?type=bucketTotal&bucket=${bucket}`);
  if (!res.ok) throw new Error("Failed to fetch bucket total");
  const { data } = await res.json();
  return data;
}

export async function getPortfolioAccountTotal(accountId: number): Promise<number> {
  const res = await fetch(`/api/portfolio/summary?type=accountTotal&accountId=${accountId}`);
  if (!res.ok) throw new Error("Failed to fetch account total");
  const { data } = await res.json();
  return data;
}

export async function getNetWorthChange(): Promise<{
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}> {
  const res = await fetch("/api/portfolio/summary?type=change");
  if (!res.ok) throw new Error("Failed to fetch net worth change");
  const { data } = await res.json();
  return data;
}
