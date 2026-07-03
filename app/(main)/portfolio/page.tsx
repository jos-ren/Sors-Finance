"use client";

import { useMemo, useState, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  FileClock,
  History,
  Trash2,
  Pencil,
  RefreshCw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  useNetWorthSummary,
  useNetWorthChange,
  usePortfolioSnapshots,
  usePortfolioAccounts,
  usePortfolioItems,
  deletePortfolioSnapshot,
  BUCKET_TYPES,
  type DbPortfolioSnapshot,
} from '@/hooks/use-database';
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency, useTimezone } from "@/contexts/settings-context";
import { formatDateTime } from "@/lib/utils/formatters";
import { useSetPageHeader, useIsInHeader } from "@/contexts/page-header-context";
import { BucketCard, EditSnapshotDialog } from "@/components/features/portfolio";
import { SectionHeader, RowGroup, AccordionRow } from "@/components/ui/section";
import { NavigateRow } from "@/components/features/settings/settings-shared";
import { cn } from "@/lib/utils";
import { PlaidSyncButton } from "@/components/features/plaid/plaid-sync-button";
import { PlaidSyncBanner } from "@/components/features/plaid/plaid-sync-banner";
import { toast } from "sonner";
import { IconBadge } from "@/components/ui/icon-badge";

const BUCKET_COLORS: Record<string, string> = {
  Savings: "var(--alt-emerald)",
  Investments: "var(--alt-blue)",
  Assets: "var(--alt-amber)",
  Debt: "var(--alt-red)",
};

const netWorthChartConfig = {
  netWorth: {
    label: "Net Worth",
    color: "var(--alt-lime)",
  },
  savings: {
    label: "Savings",
    color: "var(--alt-emerald)",
  },
  investments: {
    label: "Investments",
    color: "var(--alt-blue)",
  },
  assets: {
    label: "Assets",
    color: "var(--alt-amber)",
  },
  debt: {
    label: "Debt",
    color: "var(--alt-red)",
  },
} satisfies ChartConfig;

type TrendPeriod = "all" | "year";

function PortfolioHeaderActions({ onSyncComplete }: { onSyncComplete: Parameters<typeof PlaidSyncButton>[0]["onSyncComplete"] }) {
  const isInHeader = useIsInHeader();
  return <PlaidSyncButton variant={isInHeader ? "ghost" : "secondary"} size={isInHeader ? "icon-sm" : "sm"} onSyncComplete={onSyncComplete} />;
}

export default function PortfolioPage() {
  const { formatAmount, isPrivacyMode } = usePrivacy();
  const userCurrency = useCurrency();
  const userTimezone = useTimezone();
  const summary = useNetWorthSummary();
  const change = useNetWorthChange();
  const allSnapshots = usePortfolioSnapshots();

  // Snapshot state
  const [editingSnapshot, setEditingSnapshot] = useState<DbPortfolioSnapshot | null>(null);

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

  // Trend chart period state
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("all");
  const [trendYear, setTrendYear] = useState(currentYear);

  // Get the latest snapshot to compare with current net worth
  const latestSnapshot = useMemo(() => {
    if (!allSnapshots || allSnapshots.length === 0) return null;
    return allSnapshots[0]; // Already sorted by date desc
  }, [allSnapshots]);

  const handleDeleteSnapshot = useCallback(async (id: number) => {
    try {
      // Get snapshot data before deleting (for undo)
      const snapshot = allSnapshots?.find(s => s.id === id);
      if (!snapshot) return;

      await deletePortfolioSnapshot(id);

      toast.success("Snapshot deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              // Re-create the snapshot via API
              const res = await fetch("/api/portfolio/snapshots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  date: snapshot.date.toISOString(),
                  totalSavings: snapshot.totalSavings,
                  totalInvestments: snapshot.totalInvestments,
                  totalAssets: snapshot.totalAssets,
                  totalDebt: snapshot.totalDebt,
                  netWorth: snapshot.netWorth,
                  details: snapshot.details,
                }),
              });
              if (!res.ok) throw new Error("Failed to restore");
              toast.success("Snapshot restored");
            } catch {
              toast.error("Failed to restore snapshot");
            }
          },
        },
        actionButtonStyle: { backgroundColor: "#16a34a", color: "white" },
      });
    } catch (error) {
      toast.error("Failed to delete snapshot");
      console.error(error);
    }
  }, [allSnapshots]);

  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const handleTakeSnapshot = useCallback(async () => {
    setIsSnapshotting(true);
    try {
      const res = await fetch("/api/portfolio/snapshots/today", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.action === "updated" ? "Snapshot updated" : "Snapshot created");
    } catch {
      toast.error("Failed to take snapshot");
    } finally {
      setIsSnapshotting(false);
    }
  }, []);

  const headerActions = useMemo(() => (
    <PortfolioHeaderActions onSyncComplete={setSyncResult} />
  ), []);

  const sentinelRef = useSetPageHeader("Portfolio", headerActions);

  // Available years from snapshots
  const availableYears = useMemo(() => {
    if (!allSnapshots || allSnapshots.length === 0) return [currentYear];
    const years = [...new Set(allSnapshots.map(s => s.date.getFullYear()))].sort((a, b) => b - a);
    return years.length > 0 ? years : [currentYear];
  }, [allSnapshots, currentYear]);

  // Transform snapshot data for chart based on selected period
  const trendData = useMemo(() => {
    if (!allSnapshots || allSnapshots.length === 0) return [];

    let filtered = allSnapshots;

    if (trendPeriod === "year") {
      filtered = allSnapshots.filter(s => s.date.getFullYear() === trendYear);
    }
    // "all" = no filtering

    // Determine date format based on data span
    const reversed = [...filtered].reverse();
    const spansMultipleYears = reversed.length > 1 &&
      reversed[0].date.getFullYear() !== reversed[reversed.length - 1].date.getFullYear();

    // Reverse to show oldest first (allSnapshots is sorted newest first)
    return reversed.map(s => ({
      date: trendPeriod === "year"
        ? reversed.length > 12
          ? s.date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: userTimezone })
          : s.date.toLocaleDateString("en-US", { month: "short", timeZone: userTimezone })
        : spansMultipleYears
          ? s.date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: userTimezone })
          : s.date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: userTimezone }),
      netWorth: s.netWorth,
      savings: s.totalSavings,
      investments: s.totalInvestments,
      assets: s.totalAssets,
      debt: s.totalDebt,
    }));
  }, [allSnapshots, trendPeriod, trendYear]);

  const netWorth = summary?.netWorth ?? 0;
  const totalAssets = (summary?.totalSavings ?? 0) + (summary?.totalInvestments ?? 0) + (summary?.totalAssets ?? 0);
  const totalDebt = summary?.totalDebt ?? 0;
  const changeAmount = change?.change ?? 0;
  const changePercent = change?.changePercent ?? 0;

  // Allocation chart
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
      return (["Savings", "Investments", "Assets", "Debt"] as const).flatMap((bucket) =>
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
      { name: "Debt",        value: summary?.totalDebt         ?? 0, color: BUCKET_COLORS.Debt },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-muted-foreground">Track your net worth</p>
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

      {/* Net Worth Trend Chart */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardDescription className="mb-1">Net Worth</CardDescription>
            <CardTitle className="text-3xl font-bold">{formatAmount(netWorth, userCurrency)}</CardTitle>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {changeAmount >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              {changeAmount >= 0 ? "+" : ""}{formatAmount(changeAmount, userCurrency)}{!isPrivacyMode && ` (${changePercent.toFixed(1)}%)`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={trendPeriod} onValueChange={(v) => setTrendPeriod(v as TrendPeriod)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs px-3 h-6">All</TabsTrigger>
                <TabsTrigger value="year" className="text-xs px-3 h-6">Year</TabsTrigger>
              </TabsList>
            </Tabs>
            {trendPeriod === "year" && (
              <Select value={trendYear.toString()} onValueChange={(v) => setTrendYear(parseInt(v))}>
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              {allSnapshots && allSnapshots.length > 0
                ? "No snapshots for this period"
                : <Loader2 className="h-6 w-6 animate-spin" />
              }
            </div>
          ) : (
            <ChartContainer config={netWorthChartConfig} className="h-[300px] w-full">
              <LineChart data={trendData} margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={40}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => formatAmount(value, userCurrency, false)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, item) => (
                        <div className="flex w-full items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: item.color }}
                          />
                          <div className="flex flex-1 justify-between gap-4">
                            <span className="text-muted-foreground">
                              {netWorthChartConfig[name as keyof typeof netWorthChartConfig]?.label || name}
                            </span>
                            <span className="font-mono font-medium tabular-nums">
                              {formatAmount(Number(value), userCurrency)}
                            </span>
                          </div>
                        </div>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  dataKey="netWorth"
                  type="monotone"
                  stroke="var(--alt-lime)"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  dataKey="savings"
                  type="monotone"
                  stroke="var(--alt-emerald)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="investments"
                  type="monotone"
                  stroke="var(--alt-blue)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="assets"
                  type="monotone"
                  stroke="var(--alt-amber)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="debt"
                  type="monotone"
                  stroke="var(--alt-red)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Allocation Chart + Bucket Cards */}
      <div className="grid grid-cols-[35fr_65fr] gap-4 items-stretch">
        {/* Pie chart card */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base">Allocation</CardTitle>
              <CardDescription>
                {showAllocationAccounts ? "By account" : "By bucket"}
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
                                <span>{formatAmount(Number(value), userCurrency)}</span>
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
                        <span className="font-medium tabular-nums">{formatAmount(entry.value, userCurrency)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 2×2 Bucket Cards */}
        <div className="grid grid-cols-2 gap-4 h-full">
          {BUCKET_TYPES.map((bucket) => (
            <BucketCard key={bucket} bucket={bucket} className="h-full" />
          ))}
        </div>
      </div>

      {/* Change History */}
      <section className="space-y-2">
        <SectionHeader label="Change History" />
        <RowGroup>
          <NavigateRow
            icon={<FileClock className="h-4 w-4" />}
            title="Portfolio Change History"
            description="View all edits, syncs, and price refreshes of your portfolio items"
            href="/portfolio/history"
          />
        </RowGroup>
      </section>

      {/* Snapshot History */}
      <section className="space-y-2">
        <SectionHeader label="Snapshot History" />
        <RowGroup>
          {!allSnapshots || allSnapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <History className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No snapshots yet</p>
              <p className="text-xs text-muted-foreground">
                Snapshots are automatically saved when you visit this page
              </p>
            </div>
          ) : (
            <AccordionRow
              icon={<History className="h-4 w-4 text-muted-foreground" />}
              title="Snapshot History"
              subtitle={`${allSnapshots.length} snapshot${allSnapshots.length !== 1 ? "s" : ""}`}
              maxItems={50}
            >
              {allSnapshots.map((snapshot) => {
                const today = new Date();
                const isToday =
                  snapshot.date.getFullYear() === today.getFullYear() &&
                  snapshot.date.getMonth() === today.getMonth() &&
                  snapshot.date.getDate() === today.getDate();

                return (
                  <div key={snapshot.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex w-9 shrink-0 justify-center">
                      <IconBadge>
                        <History className="h-4 w-4 text-muted-foreground" />
                      </IconBadge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {formatDateTime(snapshot.createdAt, userTimezone)}
                      </p>
                      <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span className="text-emerald-500">
                          Savings: {formatAmount(snapshot.totalSavings, userCurrency, false)}
                        </span>
                        <span className="text-blue-500">
                          Inv: {formatAmount(snapshot.totalInvestments, userCurrency, false)}
                        </span>
                        <span className="text-amber-500">
                          Assets: {formatAmount(snapshot.totalAssets, userCurrency, false)}
                        </span>
                        <span className="text-red-500">
                          Debt: {formatAmount(snapshot.totalDebt, userCurrency, false)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold tabular-nums shrink-0">
                      {formatAmount(snapshot.netWorth, userCurrency)}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {isToday ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={handleTakeSnapshot}
                          disabled={isSnapshotting}
                        >
                          <RefreshCw className={cn("h-4 w-4", isSnapshotting && "animate-spin")} />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingSnapshot(snapshot)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteSnapshot(snapshot.id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </AccordionRow>
          )}
        </RowGroup>
      </section>



      {/* Edit Snapshot Dialog */}
      {editingSnapshot && (
        <EditSnapshotDialog
          open={!!editingSnapshot}
          onOpenChange={(open) => !open && setEditingSnapshot(null)}
          snapshot={editingSnapshot}
        />
      )}
    </div>
  );
}
