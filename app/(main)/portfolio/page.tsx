"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileClock, History } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  useNetWorthSummary,
  usePortfolioSnapshots,
  usePortfolioAccounts,
  usePortfolioItems,
  BUCKET_TYPES,
} from '@/hooks/use-database';
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { useSetPageHeader, useIsInHeader } from "@/contexts/page-header-context";
import { BucketCard } from "@/components/features/portfolio";
import { SectionHeader, RowGroup } from "@/components/ui/section";
import { NavigateRow } from "@/components/features/settings/settings-shared";
import { PlaidSyncButton } from "@/components/features/plaid/plaid-sync-button";
import { PlaidSyncBanner } from "@/components/features/plaid/plaid-sync-banner";

const BUCKET_COLORS: Record<string, string> = {
  Savings: "var(--alt-emerald)",
  Investments: "var(--alt-blue)",
  Assets: "var(--alt-amber)",
  Debt: "var(--alt-red)",
};

function PortfolioHeaderActions({ onSyncComplete }: { onSyncComplete: Parameters<typeof PlaidSyncButton>[0]["onSyncComplete"] }) {
  const isInHeader = useIsInHeader();
  return <PlaidSyncButton variant={isInHeader ? "ghost" : "secondary"} size={isInHeader ? "icon-sm" : "sm"} onSyncComplete={onSyncComplete} />;
}

/**
 * Accounts: where you manage what Home summarizes. The net worth trend lives
 * on Home (see docs/plans/home-dashboard-plan.md, Phase 3); this page keeps
 * allocation, per-bucket cards and history.
 */
export default function PortfolioPage() {
  const { formatAmount } = usePrivacy();
  const userCurrency = useCurrency();
  const summary = useNetWorthSummary();
  const allSnapshots = usePortfolioSnapshots();

  // Plaid sync banner state
  const [syncResult, setSyncResult] = useState<{
    accountsUpdated: number;
    accountsFailed: number;
    pricesUpdated: number;
    pricesFailed: number;
    errors: string[];
    priceErrors: Array<{
      ticker: string;
      itemName: string;
      error: string;
    }>;
    syncedAccounts: Array<{
      accountId: string;
      name: string;
      balance: number;
    }>;
    syncedPrices: Array<{
      ticker: string;
      itemName: string;
      price: number;
      currency: string;
    }>;
  } | null>(null);

  const headerActions = useMemo(() => (
    <PortfolioHeaderActions onSyncComplete={setSyncResult} />
  ), []);

  const sentinelRef = useSetPageHeader("Accounts", headerActions);

  const netWorth = summary?.netWorth ?? 0;
  const totalOwned = (summary?.totalSavings ?? 0) + (summary?.totalInvestments ?? 0) + (summary?.totalAssets ?? 0);
  const totalDebt = summary?.totalDebt ?? 0;

  // Allocation chart: what you own. Debt is a claim against it, so it is
  // listed under the legend instead of drawn as a slice.
  const [showAllocationAccounts, setShowAllocationAccounts] = useState(false);
  const allAccounts = usePortfolioAccounts();
  const allItems = usePortfolioItems();

  const allocationData = useMemo(() => {
    if (showAllocationAccounts) {
      if (!allAccounts || !allItems) return [];
      const accountTotals = new Map<number, number>();
      for (const item of allItems) {
        if (!item.isActive) continue;
        accountTotals.set(item.accountId, (accountTotals.get(item.accountId) ?? 0) + item.currentValue);
      }
      return (["Savings", "Investments", "Assets"] as const).flatMap((bucket) =>
        allAccounts
          .filter((a) => a.bucket === bucket)
          .map((a) => ({ name: a.name, value: accountTotals.get(a.id!) ?? 0, color: BUCKET_COLORS[bucket] }))
          .filter((a) => a.value > 0)
      );
    }
    return ([
      { name: "Savings",     value: summary?.totalSavings     ?? 0, color: BUCKET_COLORS.Savings },
      { name: "Investments", value: summary?.totalInvestments  ?? 0, color: BUCKET_COLORS.Investments },
      { name: "Assets",      value: summary?.totalAssets       ?? 0, color: BUCKET_COLORS.Assets },
    ] as const).filter((d) => d.value > 0);
  }, [showAllocationAccounts, summary, allAccounts, allItems]);

  const allocationTotal = useMemo(() => allocationData.reduce((s, d) => s + d.value, 0), [allocationData]);

  const allocationConfig = useMemo(
    () => allocationData.reduce((acc, item) => {
      acc[item.name] = { label: item.name, color: item.color };
      return acc;
    }, {} as ChartConfig),
    [allocationData]
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">Manage your accounts, holdings and debts</p>
          <div ref={sentinelRef} className="h-0" />
        </div>
        <PlaidSyncButton onSyncComplete={setSyncResult} />
      </div>

      {/* Plaid Sync Banner */}
      {syncResult && (
        <PlaidSyncBanner
          accountsUpdated={syncResult.accountsUpdated}
          accountsFailed={syncResult.accountsFailed}
          pricesUpdated={syncResult.pricesUpdated}
          pricesFailed={syncResult.pricesFailed}
          errors={syncResult.errors}
          priceErrors={syncResult.priceErrors}
          syncedAccounts={syncResult.syncedAccounts}
          syncedPrices={syncResult.syncedPrices}
          onDismiss={() => setSyncResult(null)}
        />
      )}

      {/* Net worth summary (trend lives on Home) */}
      <Card className="flex flex-row flex-wrap items-center gap-x-8 gap-y-2 px-6 py-4">
        <div>
          <p className="text-xs text-muted-foreground">Net worth</p>
          <p className="text-2xl font-bold tabular-nums">{formatAmount(netWorth, userCurrency, false)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">You own</p>
          <p className="text-lg font-semibold tabular-nums">{formatAmount(totalOwned, userCurrency, false)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">You owe</p>
          <p className="text-lg font-semibold tabular-nums">{formatAmount(totalDebt, userCurrency, false)}</p>
        </div>
        <Link href="/" className="ml-auto text-sm text-muted-foreground hover:text-foreground">
          See your net worth trend on Home →
        </Link>
      </Card>

      {/* Allocation Chart + Bucket Cards */}
      <div className="grid grid-cols-1 gap-4 items-stretch lg:grid-cols-[35fr_65fr] [&>*]:min-w-0">
        {/* Pie chart card */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base">Allocation</CardTitle>
              <CardDescription>
                {showAllocationAccounts ? "What you own, by account" : "What you own, by bucket"}
              </CardDescription>
            </div>
            <Tabs value={showAllocationAccounts ? "accounts" : "buckets"} onValueChange={(v) => setShowAllocationAccounts(v === "accounts")}>
              <TabsList className="h-8">
                <TabsTrigger value="buckets" className="text-xs px-3 h-6">Buckets</TabsTrigger>
                <TabsTrigger value="accounts" className="text-xs px-3 h-6">Accounts</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 pb-4">
            {allocationData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No data yet
              </div>
            ) : (
              <>
                <ChartContainer config={allocationConfig} className="h-52 w-full">
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          nameKey="name"
                          labelFormatter={(_, payload) => payload?.[0]?.name ?? ""}
                          formatter={(value) => {
                            const pct = allocationTotal > 0
                              ? ((Number(value) / allocationTotal) * 100).toFixed(1)
                              : "0";
                            return (
                              <span className="flex items-center justify-between gap-4 w-full">
                                <span>{formatAmount(Number(value), userCurrency, false)}</span>
                                <span className="text-muted-foreground">{pct}%</span>
                              </span>
                            );
                          }}
                        />
                      }
                    />
                    <Pie
                      data={allocationData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {allocationData.map((entry, i) => (
                        <Cell
                          key={`alloc-${i}`}
                          fill={entry.color}
                          fillOpacity={0.6}
                          stroke={entry.color}
                          strokeWidth={1.5}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="w-full space-y-1.5 max-h-36 overflow-y-auto rounded-md border border-border bg-muted/30 px-3 py-2">
                  {allocationData.map((entry, i) => {
                    const pct = allocationTotal > 0
                      ? ((entry.value / allocationTotal) * 100).toFixed(1)
                      : "0";
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
                        <span className="flex-1 truncate text-muted-foreground">{entry.name}</span>
                        <span className="font-medium tabular-nums">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
                {totalDebt > 0 && (
                  <div className="w-full flex items-center gap-2 px-3 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: BUCKET_COLORS.Debt }} />
                    <span className="flex-1 text-muted-foreground">Debt owed</span>
                    <span className="font-medium tabular-nums">{formatAmount(totalDebt, userCurrency, false)}</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 2×2 Bucket Cards */}
        <div className="grid grid-cols-1 gap-4 h-full sm:grid-cols-2 [&>*]:min-w-0">
          {BUCKET_TYPES.map((bucket) => (
            <BucketCard key={bucket} bucket={bucket} className="h-full" />
          ))}
        </div>
      </div>

      {/* Change History */}
      <section className="space-y-2">
        <SectionHeader label="History" />
        <RowGroup>
          <NavigateRow
            icon={<FileClock className="h-4 w-4" />}
            title="Account Change History"
            description="View all edits, syncs, and price refreshes of your account items"
            href="/portfolio/history"
          />
          <NavigateRow
            icon={<History className="h-4 w-4" />}
            title="Snapshot History"
            description={
              allSnapshots
                ? `${allSnapshots.length} snapshot${allSnapshots.length !== 1 ? "s" : ""} of your net worth over time`
                : "View, edit, and manage your net worth snapshots"
            }
            href="/portfolio/snapshots"
          />
        </RowGroup>
      </section>
    </div>
  );
}
