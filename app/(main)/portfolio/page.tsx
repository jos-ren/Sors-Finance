"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  CreditCard,
  Loader2,
  ChevronDown,
  History,
  Trash2,
  Pencil,
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
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  deletePortfolioSnapshot,
  BUCKET_TYPES,
  type DbPortfolioSnapshot,
} from "@/lib/hooks/useDatabase";
import { usePrivacy } from "@/lib/privacy-context";
import { useCurrency } from "@/lib/settings-context";
import { useSetPageHeader } from "@/lib/page-header-context";
import { BucketCard, EditSnapshotDialog } from "@/components/portfolio";
import { PlaidSyncButton } from "@/components/plaid/PlaidSyncButton";
import { PlaidSyncBanner } from "@/components/plaid/PlaidSyncBanner";
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

const bucketChartConfig = {
  Savings: { label: "Savings", color: "var(--alt-emerald)" },
  Investments: { label: "Investments", color: "var(--alt-blue)" },
  Assets: { label: "Assets", color: "var(--alt-amber)" },
  Debt: { label: "Debt", color: "var(--alt-red)" },
} satisfies ChartConfig;

type TrendPeriod = "all" | "year";

export default function PortfolioPage() {
  const { formatAmount, isPrivacyMode } = usePrivacy();
  const userCurrency = useCurrency();
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

  const headerActions = useMemo(() => (
    <PlaidSyncButton onSyncComplete={setSyncResult} />
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
          ? s.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : s.date.toLocaleDateString("en-US", { month: "short" })
        : spansMultipleYears
          ? s.date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
          : s.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      netWorth: s.netWorth,
      savings: s.totalSavings,
      investments: s.totalInvestments,
      assets: s.totalAssets,
      debt: s.totalDebt,
    }));
  }, [allSnapshots, trendPeriod, trendYear]);

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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(netWorth, userCurrency)}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {changeAmount >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              {changeAmount >= 0 ? "+" : ""}{formatAmount(changeAmount, userCurrency)}{!isPrivacyMode && ` (${changePercent.toFixed(1)}%)`}
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
              {formatAmount(totalAssets, userCurrency)}
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
              {formatAmount(totalDebt, userCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">
              All liabilities
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Net Worth Trend Chart */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Portfolio Trend</CardTitle>
            <CardDescription>Net worth and breakdown over time</CardDescription>
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
                    content={<ChartTooltipContent hideLabel formatter={(value) => formatAmount(Number(value), userCurrency)} />}
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
                    tickFormatter={(value) => formatAmount(value, userCurrency, false)}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent formatter={(value) => formatAmount(Number(value), userCurrency)} />}
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
                    Snapshots are automatically saved when you visit this page
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
                          <span className="text-sm text-muted-foreground">
                            {snapshot.createdAt.toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="text-lg font-semibold">
                            {formatAmount(snapshot.netWorth, userCurrency)}
                          </span>
                        </div>
                        <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="text-emerald-500">
                            Savings: {formatAmount(snapshot.totalSavings, userCurrency, false)}
                          </span>
                          <span className="text-blue-500">
                            Investments: {formatAmount(snapshot.totalInvestments, userCurrency, false)}
                          </span>
                          <span className="text-amber-500">
                            Assets: {formatAmount(snapshot.totalAssets, userCurrency, false)}
                          </span>
                          <span className="text-red-500">
                            Debt: {formatAmount(snapshot.totalDebt, userCurrency, false)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {(() => {
                          const today = new Date();
                          const isToday =
                            snapshot.date.getFullYear() === today.getFullYear() &&
                            snapshot.date.getMonth() === today.getMonth() &&
                            snapshot.date.getDate() === today.getDate();
                          return !isToday ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => setEditingSnapshot(snapshot)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null;
                        })()}
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
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
