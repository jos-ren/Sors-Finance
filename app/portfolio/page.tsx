"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Camera,
  DollarSign,
  Wallet,
  CreditCard,
  Loader2,
  AlertTriangle,
  ChevronDown,
  History,
  Trash2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  createSnapshotWithPriceRefresh,
  deletePortfolioSnapshot,
  BUCKET_TYPES,
  type SnapshotResult,
} from "@/lib/hooks/useDatabase";
import { usePrivacy } from "@/lib/privacy-context";
import { useSetPageHeader } from "@/lib/page-header-context";
import { BucketCard } from "@/components/portfolio";
import { toast } from "sonner";

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
} satisfies ChartConfig;

const bucketChartConfig = {
  Savings: { label: "Savings", color: "var(--alt-emerald)" },
  Investments: { label: "Investments", color: "var(--alt-blue)" },
  Assets: { label: "Assets", color: "var(--alt-amber)" },
  Debt: { label: "Debt", color: "var(--alt-red)" },
} satisfies ChartConfig;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatCompact(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    notation: "compact",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function PortfolioPage() {
  const { formatAmount } = usePrivacy();
  const summary = useNetWorthSummary();
  const change = useNetWorthChange();
  const allSnapshots = usePortfolioSnapshots();

  // Snapshot state
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [snapshotError, setSnapshotError] = useState<SnapshotResult | null>(null);
  const autoSnapshotAttempted = useRef(false);

  // Get the latest snapshot to compare with current net worth
  const latestSnapshot = useMemo(() => {
    if (!allSnapshots || allSnapshots.length === 0) return null;
    return allSnapshots[0]; // Already sorted by date desc
  }, [allSnapshots]);

  // Auto-snapshot on page load (once per session)
  // If current net worth differs from latest snapshot, update today's snapshot
  useEffect(() => {
    if (autoSnapshotAttempted.current) return;
    if (summary === undefined) return; // Wait for summary to load

    autoSnapshotAttempted.current = true;

    const autoSnapshot = async () => {
      const currentNetWorth = summary?.netWorth ?? 0;
      const latestSnapshotNetWorth = latestSnapshot?.netWorth ?? 0;

      // Check if latest snapshot is from today
      const today = new Date();
      const isSnapshotFromToday = latestSnapshot &&
        latestSnapshot.date.getFullYear() === today.getFullYear() &&
        latestSnapshot.date.getMonth() === today.getMonth() &&
        latestSnapshot.date.getDate() === today.getDate();

      // Check if net worth has changed (use small epsilon for float comparison)
      const hasChanged = Math.abs(currentNetWorth - latestSnapshotNetWorth) > 0.01;

      // If today's snapshot exists but net worth changed, update it
      if (isSnapshotFromToday && hasChanged) {
        setIsSnapshotting(true);
        setSnapshotError(null);

        const result = await createSnapshotWithPriceRefresh({ forceUpdate: true });

        if (result.success) {
          toast.success("Portfolio snapshot updated");
        } else {
          setSnapshotError(result);
        }

        setIsSnapshotting(false);
      }
      // If no snapshot today, create one (normal behavior)
      else if (!isSnapshotFromToday) {
        setIsSnapshotting(true);
        setSnapshotError(null);

        const result = await createSnapshotWithPriceRefresh();

        if (result.success && !result.alreadyExists) {
          toast.success("Portfolio snapshot saved");
        } else if (!result.success) {
          setSnapshotError(result);
        }

        setIsSnapshotting(false);
      }
      // If today's snapshot exists and net worth matches, do nothing
    };

    autoSnapshot();
  }, [summary, latestSnapshot]);

  const handleSnapshot = useCallback(async () => {
    setIsSnapshotting(true);
    setSnapshotError(null);

    // Use forceUpdate: true to replace existing snapshot for today
    const result = await createSnapshotWithPriceRefresh({ forceUpdate: true });

    if (result.success) {
      toast.success("Snapshot updated");
    } else {
      setSnapshotError(result);
      toast.error(result.error || "Failed to save snapshot");
    }

    setIsSnapshotting(false);
  }, []);

  const handleDeleteSnapshot = useCallback(async (id: number) => {
    try {
      await deletePortfolioSnapshot(id);
      toast.success("Snapshot deleted");
    } catch (error) {
      toast.error("Failed to delete snapshot");
      console.error(error);
    }
  }, []);

  // Header actions - memoized to prevent infinite re-renders
  const headerActions = useMemo(() => (
    <Button size="sm" onClick={handleSnapshot} disabled={isSnapshotting}>
      {isSnapshotting ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Camera className="h-4 w-4 mr-2" />
      )}
      Snapshot
    </Button>
  ), [handleSnapshot, isSnapshotting]);

  const sentinelRef = useSetPageHeader("Portfolio", headerActions);

  // Transform snapshot data for chart (use allSnapshots, limit to last 12 months)
  const trendData = useMemo(() => {
    if (!allSnapshots || allSnapshots.length === 0) return [];

    // Filter to last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const filtered = allSnapshots.filter(s => s.date >= twelveMonthsAgo);

    // Reverse to show oldest first (allSnapshots is sorted newest first)
    return [...filtered].reverse().map(s => ({
      date: s.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      netWorth: s.netWorth,
    }));
  }, [allSnapshots]);

  // Bucket breakdown for pie chart
  const bucketData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "Savings", value: summary.totalSavings, fill: BUCKET_COLORS.Savings },
      { name: "Investments", value: summary.totalInvestments, fill: BUCKET_COLORS.Investments },
      { name: "Assets", value: summary.totalAssets, fill: BUCKET_COLORS.Assets },
    ].filter(b => b.value > 0);
  }, [summary]);

  // Assets vs Debt for bar chart
  const comparisonData = useMemo(() => {
    if (!summary) return [];
    const totalPositive = summary.totalSavings + summary.totalInvestments + summary.totalAssets;
    return [
      { name: "Assets", value: totalPositive, fill: "var(--alt-emerald)" },
      { name: "Debt", value: summary.totalDebt, fill: "var(--alt-red)" },
    ];
  }, [summary]);

  const netWorth = summary?.netWorth ?? 0;
  const totalAssets = (summary?.totalSavings ?? 0) + (summary?.totalInvestments ?? 0) + (summary?.totalAssets ?? 0);
  const totalDebt = summary?.totalDebt ?? 0;
  const changeAmount = change?.change ?? 0;
  const changePercent = change?.changePercent ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-muted-foreground">Track your net worth</p>
          <div ref={sentinelRef} className="h-0" />
        </div>
        <Button onClick={handleSnapshot} disabled={isSnapshotting}>
          {isSnapshotting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Camera className="h-4 w-4 mr-2" />
          )}
          Take Snapshot
        </Button>
      </div>

      {/* Ticker Price Error Warning */}
      {snapshotError && snapshotError.priceRefreshResult?.failed && snapshotError.priceRefreshResult.failed.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Failed to Update Prices
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="text-muted-foreground mb-2">
              Could not fetch prices for the following tickers. Snapshot was not saved.
            </p>
            <ul className="list-disc list-inside space-y-1">
              {snapshotError.priceRefreshResult.failed.map((f, i) => (
                <li key={i}>
                  <span className="font-mono">{f.ticker}</span> ({f.itemName}): {f.error}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-2">
              To resolve: Edit these items and either fix the ticker symbol or switch to manual price mode.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(netWorth, formatCurrency)}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {changeAmount >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              {changeAmount >= 0 ? "+" : ""}{formatAmount(changeAmount, formatCurrency)} ({changePercent.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(totalAssets, formatCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Savings + Investments + Assets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debt</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(totalDebt, formatCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">
              All liabilities
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Net Worth Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Net Worth Trend</CardTitle>
          <CardDescription>Your net worth over time</CardDescription>
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <ChartContainer config={netWorthChartConfig} className="h-[300px] w-full">
              <AreaChart data={trendData} margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => formatCompact(value)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Area
                  dataKey="netWorth"
                  type="monotone"
                  fill="var(--alt-lime)"
                  fillOpacity={0.4}
                  stroke="var(--alt-lime)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bucket Breakdown Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Asset Allocation</CardTitle>
            <CardDescription>Breakdown by bucket type</CardDescription>
          </CardHeader>
          <CardContent>
            {bucketData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Add items to see your asset allocation.
              </div>
            ) : (
              <ChartContainer config={bucketChartConfig} className="h-[300px] w-full">
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Pie
                    data={bucketData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {bucketData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fill}
                        fillOpacity={0.7}
                        stroke={entry.fill}
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <ChartLegend
                    content={<ChartLegendContent nameKey="name" />}
                    className="-translate-y-2 flex-wrap gap-2"
                  />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Assets vs Debt Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Assets vs Debt</CardTitle>
            <CardDescription>Compare your assets to liabilities</CardDescription>
          </CardHeader>
          <CardContent>
            {totalAssets === 0 && totalDebt === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Add items to compare assets and debt.
              </div>
            ) : (
              <ChartContainer config={bucketChartConfig} className="h-[300px] w-full">
                <BarChart data={comparisonData} layout="vertical" margin={{ left: 12, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={60}
                  />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => formatCompact(value)}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent />}
                  />
                  <Bar dataKey="value" radius={4}>
                    {comparisonData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fill}
                        fillOpacity={0.7}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bucket Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Buckets</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BUCKET_TYPES.map((bucket) => (
            <BucketCard key={bucket} bucket={bucket} />
          ))}
        </div>
      </div>

      {/* Snapshot History */}
      <Collapsible defaultOpen={false}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle>Snapshot History</CardTitle>
                  {allSnapshots && allSnapshots.length > 0 && (
                    <Badge variant="secondary">{allSnapshots.length}</Badge>
                  )}
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
              </div>
              <CardDescription>
                View your portfolio snapshots over time. Only 1 can be taken per day.
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {!allSnapshots || allSnapshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <History className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="font-medium">No snapshots yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click &quot;Take Snapshot&quot; to save your first portfolio snapshot
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allSnapshots.map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">
                            {snapshot.date.toLocaleDateString("en-US", {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-lg font-semibold">
                            {formatAmount(snapshot.netWorth, formatCurrency)}
                          </span>
                        </div>
                        <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="text-emerald-500">
                            Savings: {formatAmount(snapshot.totalSavings, formatCompact)}
                          </span>
                          <span className="text-blue-500">
                            Investments: {formatAmount(snapshot.totalInvestments, formatCompact)}
                          </span>
                          <span className="text-amber-500">
                            Assets: {formatAmount(snapshot.totalAssets, formatCompact)}
                          </span>
                          <span className="text-red-500">
                            Debt: {formatAmount(snapshot.totalDebt, formatCompact)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteSnapshot(snapshot.id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
