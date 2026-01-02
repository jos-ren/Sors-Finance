/**
 * Portfolio Operations
 *
 * CRUD operations for portfolio accounts, items, and snapshots.
 */

import { db } from "./instance";
import type {
  DbPortfolioAccount,
  DbPortfolioItem,
  DbPortfolioSnapshot,
  BucketType,
  AddPortfolioItemData,
} from "./types";

// ============================================
// Account Operations
// ============================================

export async function getPortfolioAccounts(bucket?: BucketType): Promise<DbPortfolioAccount[]> {
  if (bucket) {
    return db.portfolioAccounts.where("bucket").equals(bucket).sortBy("order");
  }
  return db.portfolioAccounts.orderBy("order").toArray();
}

export async function getPortfolioAccountById(id: number): Promise<DbPortfolioAccount | undefined> {
  return db.portfolioAccounts.get(id);
}

export async function addPortfolioAccount(bucket: BucketType, name: string): Promise<number> {
  const accountsInBucket = await db.portfolioAccounts.where("bucket").equals(bucket).toArray();
  const maxOrder = accountsInBucket.reduce((max, c) => Math.max(max, c.order), -1);

  return db.portfolioAccounts.add({
    uuid: crypto.randomUUID(),
    bucket,
    name,
    order: maxOrder + 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function updatePortfolioAccount(
  id: number,
  updates: Partial<Pick<DbPortfolioAccount, "name">>
): Promise<void> {
  await db.portfolioAccounts.update(id, {
    ...updates,
    updatedAt: new Date(),
  });
}

export async function deletePortfolioAccount(id: number): Promise<void> {
  await db.transaction("rw", [db.portfolioAccounts, db.portfolioItems], async () => {
    await db.portfolioItems.where("accountId").equals(id).delete();
    await db.portfolioAccounts.delete(id);
  });
}

export async function reorderPortfolioAccounts(
  bucket: BucketType,
  activeId: number,
  overId: number
): Promise<void> {
  const accounts = await db.portfolioAccounts.where("bucket").equals(bucket).sortBy("order");
  const activeIndex = accounts.findIndex(c => c.id === activeId);
  const overIndex = accounts.findIndex(c => c.id === overId);

  if (activeIndex === -1 || overIndex === -1) return;

  const [moved] = accounts.splice(activeIndex, 1);
  accounts.splice(overIndex, 0, moved);

  await db.transaction("rw", db.portfolioAccounts, async () => {
    for (let i = 0; i < accounts.length; i++) {
      await db.portfolioAccounts.update(accounts[i].id!, { order: i, updatedAt: new Date() });
    }
  });
}

// ============================================
// Item Operations
// ============================================

export async function getPortfolioItems(
  accountId?: number,
  includeInactive = false
): Promise<DbPortfolioItem[]> {
  let items: DbPortfolioItem[];

  if (accountId !== undefined) {
    items = await db.portfolioItems.where("accountId").equals(accountId).sortBy("order");
  } else {
    items = await db.portfolioItems.orderBy("order").toArray();
  }

  if (!includeInactive) {
    items = items.filter(i => i.isActive);
  }

  return items;
}

export async function getPortfolioItemById(id: number): Promise<DbPortfolioItem | undefined> {
  return db.portfolioItems.get(id);
}

export async function addPortfolioItem(data: AddPortfolioItemData): Promise<number> {
  const itemsInAccount = await db.portfolioItems.where("accountId").equals(data.accountId).toArray();
  const maxOrder = itemsInAccount.reduce((max, i) => Math.max(max, i.order), -1);

  return db.portfolioItems.add({
    uuid: crypto.randomUUID(),
    accountId: data.accountId,
    name: data.name,
    currentValue: data.currentValue,
    notes: data.notes,
    ticker: data.ticker,
    quantity: data.quantity,
    pricePerUnit: data.pricePerUnit,
    currency: data.currency,
    lastPriceUpdate: data.lastPriceUpdate,
    priceMode: data.priceMode ?? (data.ticker ? "ticker" : "manual"),
    isInternational: data.isInternational,
    order: maxOrder + 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function updatePortfolioItem(
  id: number,
  updates: Partial<Pick<
    DbPortfolioItem,
    "name" | "currentValue" | "notes" | "accountId" | "ticker" | "quantity" | "pricePerUnit" | "currency" | "lastPriceUpdate" | "priceMode" | "isInternational"
  >>
): Promise<void> {
  await db.portfolioItems.update(id, {
    ...updates,
    updatedAt: new Date(),
  });
}

export async function deletePortfolioItem(id: number, hard = false): Promise<void> {
  if (hard) {
    await db.portfolioItems.delete(id);
  } else {
    await db.portfolioItems.update(id, { isActive: false, updatedAt: new Date() });
  }
}

export async function restorePortfolioItem(id: number): Promise<void> {
  await db.portfolioItems.update(id, { isActive: true, updatedAt: new Date() });
}

export async function reorderPortfolioItems(
  accountId: number,
  activeId: number,
  overId: number
): Promise<void> {
  const items = await db.portfolioItems
    .where("accountId")
    .equals(accountId)
    .filter(i => i.isActive)
    .sortBy("order");

  const activeIndex = items.findIndex(i => i.id === activeId);
  const overIndex = items.findIndex(i => i.id === overId);

  if (activeIndex === -1 || overIndex === -1) return;

  const [moved] = items.splice(activeIndex, 1);
  items.splice(overIndex, 0, moved);

  await db.transaction("rw", db.portfolioItems, async () => {
    for (let i = 0; i < items.length; i++) {
      await db.portfolioItems.update(items[i].id!, { order: i, updatedAt: new Date() });
    }
  });
}

export async function getTickerModeItems(): Promise<DbPortfolioItem[]> {
  return db.portfolioItems.filter(i => i.isActive && i.priceMode === "ticker" && !!i.ticker).toArray();
}

// ============================================
// Aggregations
// ============================================

export async function getBucketTotal(bucket: BucketType): Promise<number> {
  const accounts = await db.portfolioAccounts.where("bucket").equals(bucket).toArray();
  const accountIds = accounts.map(c => c.id!);

  if (accountIds.length === 0) return 0;

  const items = await db.portfolioItems
    .where("accountId")
    .anyOf(accountIds)
    .filter(i => i.isActive)
    .toArray();

  return items.reduce((sum, i) => sum + i.currentValue, 0);
}

export async function getPortfolioAccountTotal(accountId: number): Promise<number> {
  const items = await db.portfolioItems
    .where("accountId")
    .equals(accountId)
    .filter(i => i.isActive)
    .toArray();

  return items.reduce((sum, i) => sum + i.currentValue, 0);
}

export async function getNetWorthSummary(): Promise<{
  totalSavings: number;
  totalInvestments: number;
  totalAssets: number;
  totalDebt: number;
  netWorth: number;
}> {
  const [savings, investments, assets, debt] = await Promise.all([
    getBucketTotal("Savings"),
    getBucketTotal("Investments"),
    getBucketTotal("Assets"),
    getBucketTotal("Debt"),
  ]);

  return {
    totalSavings: savings,
    totalInvestments: investments,
    totalAssets: assets,
    totalDebt: debt,
    netWorth: savings + investments + assets - debt,
  };
}

export async function getBucketBreakdown(): Promise<Record<BucketType, number>> {
  const [savings, investments, assets, debt] = await Promise.all([
    getBucketTotal("Savings"),
    getBucketTotal("Investments"),
    getBucketTotal("Assets"),
    getBucketTotal("Debt"),
  ]);

  return {
    Savings: savings,
    Investments: investments,
    Assets: assets,
    Debt: debt,
  };
}

// ============================================
// Snapshot Operations
// ============================================

export async function getPortfolioSnapshots(options?: {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<DbPortfolioSnapshot[]> {
  let query = db.portfolioSnapshots.orderBy("date").reverse();

  if (options?.startDate && options?.endDate) {
    query = db.portfolioSnapshots
      .where("date")
      .between(options.startDate, options.endDate, true, true)
      .reverse();
  }

  let results = await query.toArray();

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

export async function getLatestPortfolioSnapshot(): Promise<DbPortfolioSnapshot | undefined> {
  return db.portfolioSnapshots.orderBy("date").last();
}

export async function createPortfolioSnapshot(): Promise<number> {
  const accounts = await db.portfolioAccounts.toArray();
  const items = await db.portfolioItems.filter(i => i.isActive).toArray();

  const bucketTotals: Record<BucketType, number> = {
    Savings: 0,
    Investments: 0,
    Assets: 0,
    Debt: 0,
  };

  const accountTotals = new Map<number, number>();

  for (const item of items) {
    const current = accountTotals.get(item.accountId) || 0;
    accountTotals.set(item.accountId, current + item.currentValue);
  }

  for (const account of accounts) {
    const total = accountTotals.get(account.id!) || 0;
    bucketTotals[account.bucket] += total;
  }

  const netWorth = bucketTotals.Savings + bucketTotals.Investments + bucketTotals.Assets - bucketTotals.Debt;

  const accountDetails = accounts.map(a => ({
    id: a.id!,
    bucket: a.bucket,
    name: a.name,
    total: accountTotals.get(a.id!) || 0,
  }));

  const itemDetails = items.map(i => ({
    id: i.id!,
    accountId: i.accountId,
    name: i.name,
    value: i.currentValue,
  }));

  return db.portfolioSnapshots.add({
    uuid: crypto.randomUUID(),
    date: new Date(),
    totalSavings: bucketTotals.Savings,
    totalInvestments: bucketTotals.Investments,
    totalAssets: bucketTotals.Assets,
    totalDebt: bucketTotals.Debt,
    netWorth,
    details: {
      accounts: accountDetails,
      items: itemDetails,
    },
    createdAt: new Date(),
  });
}

export async function deletePortfolioSnapshot(id: number): Promise<void> {
  await db.portfolioSnapshots.delete(id);
}

export async function updatePortfolioSnapshot(
  id: number,
  updates: Partial<Pick<DbPortfolioSnapshot, "totalSavings" | "totalInvestments" | "totalAssets" | "totalDebt">>
): Promise<void> {
  const snapshot = await db.portfolioSnapshots.get(id);
  if (!snapshot) return;

  const newTotals = {
    totalSavings: updates.totalSavings ?? snapshot.totalSavings,
    totalInvestments: updates.totalInvestments ?? snapshot.totalInvestments,
    totalAssets: updates.totalAssets ?? snapshot.totalAssets,
    totalDebt: updates.totalDebt ?? snapshot.totalDebt,
  };

  const netWorth = newTotals.totalSavings + newTotals.totalInvestments + newTotals.totalAssets - newTotals.totalDebt;

  await db.portfolioSnapshots.update(id, {
    ...newTotals,
    netWorth,
  });
}

export async function getNetWorthChange(): Promise<{
  current: number;
  previous: number;
  change: number;
  changePercent: number;
} | null> {
  const snapshots = await db.portfolioSnapshots.orderBy("date").reverse().limit(2).toArray();

  if (snapshots.length === 0) {
    const summary = await getNetWorthSummary();
    return {
      current: summary.netWorth,
      previous: summary.netWorth,
      change: 0,
      changePercent: 0,
    };
  }

  const current = snapshots[0].netWorth;
  const previous = snapshots.length > 1 ? snapshots[1].netWorth : current;
  const change = current - previous;
  const changePercent = previous !== 0 ? (change / Math.abs(previous)) * 100 : 0;

  return { current, previous, change, changePercent };
}

export async function hasSnapshotToday(): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const snapshot = await db.portfolioSnapshots
    .where("date")
    .between(today, tomorrow, true, false)
    .first();

  return !!snapshot;
}

export async function getTodaySnapshot(): Promise<DbPortfolioSnapshot | undefined> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return db.portfolioSnapshots
    .where("date")
    .between(today, tomorrow, true, false)
    .first();
}
