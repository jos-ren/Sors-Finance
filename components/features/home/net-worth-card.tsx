"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Layers, TrendingDown, TrendingUp } from "lucide-react";
import { Area, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useNetWorthRange, useNetWorthSummary, usePersistentState, type NetWorthRange } from "@/hooks";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency, useTimezone } from "@/contexts/settings-context";
import { niceTicks } from "@/lib/utils/chart-ticks";
import { CardTitleLink } from "@/components/features/home/card-title-link";
import { shortYearLabel } from "@/lib/utils/formatters";

const RANGES: NetWorthRange[] = ["1M", "3M", "YTD", "1Y", "ALL"];
const RANGE_LABEL: Record<NetWorthRange, string> = {
  "1M": "past month",
  "3M": "past 3 months",
  YTD: "this year",
  "1Y": "past year",
  ALL: "since you started",
};

type ChartView = "total" | "buckets";
const VIEWS: ChartView[] = ["total", "buckets"];

// Bucket colours match the Accounts page
const chartConfig = {
  netWorth: { label: "Net worth", color: "var(--alt-lime)" },
  savings: { label: "Savings", color: "var(--alt-emerald)" },
  investments: { label: "Investments", color: "var(--alt-blue)" },
  assets: { label: "Assets", color: "var(--alt-amber)" },
  debt: { label: "Debt", color: "var(--alt-red)" },
} satisfies ChartConfig;
const BUCKETS = ["savings", "investments", "assets", "debt"] as const;

/**
 * "Am I making progress?" — net worth now, its change over the selected range,
 * and its change this month. The bucket toggle draws each bucket as its own
 * line from zero (debt as the amount owed), alongside net worth, so you can
 * see which bucket moved.
 */
export function NetWorthCard() {
  const { formatAmount, formatAxisAmount, isPrivacyMode } = usePrivacy();
  const currency = useCurrency();
  const timezone = useTimezone();
  const [range, setRange] = usePersistentState<NetWorthRange>("sors-home-networth-range", "1Y", RANGES);
  const [view, setView] = usePersistentState<ChartView>("sors-home-networth-view", "total", VIEWS);
  const byBucket = view === "buckets";
  const summary = useNetWorthSummary();
  const snapshots = useNetWorthRange(range);
  const recent = useNetWorthRange("3M");

  const netWorth = summary?.netWorth ?? 0;
  const rangeStartValue = snapshots?.[0]?.netWorth;
  const rangeChange = rangeStartValue !== undefined ? netWorth - rangeStartValue : undefined;

  // Net worth at the start of this month: last snapshot before the 1st, else the first one in the month.
  const monthChange = useMemo(() => {
    if (!recent || recent.length === 0) return undefined;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const before = recent.filter((s) => s.date < monthStart);
    const base = before.length > 0 ? before[before.length - 1] : recent.find((s) => s.date >= monthStart);
    return base ? netWorth - base.netWorth : undefined;
  }, [recent, netWorth]);

  const chartData = useMemo(
    () =>
      (snapshots ?? []).map((s) => ({
        ts: s.date.getTime(),
        netWorth: s.netWorth,
        savings: s.totalSavings,
        investments: s.totalInvestments,
        assets: s.totalAssets,
        // Amount owed: a falling line is good news
        debt: Math.abs(s.totalDebt),
      })),
    [snapshots]
  );

  const yTicks = useMemo(() => {
    if (chartData.length === 0) return [0];
    const values = byBucket
      ? chartData.flatMap((d) => [d.savings, d.investments, d.assets, d.debt, d.netWorth])
      : chartData.map((d) => d.netWorth);
    return niceTicks(Math.min(...values), Math.max(...values), 5);
  }, [chartData, byBucket]);

  if (summary && summary.netWorth === 0 && (snapshots?.length ?? 0) === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm font-medium">Track your net worth</p>
        <p className="text-xs text-muted-foreground">Add your bank accounts, investments and debts to see how your net worth changes over time.</p>
        <Button asChild size="sm" variant="secondary">
          <Link href="/portfolio">Add accounts</Link>
        </Button>
      </Card>
    );
  }

  const signed = (v: number) => `${v >= 0 ? "+" : "−"}${formatAmount(Math.abs(v), currency, false)}`;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0">
          <CardTitleLink href="/portfolio">Net worth</CardTitleLink>
          <p className="mt-1 text-3xl font-bold tabular-nums">{formatAmount(netWorth, currency, false)}</p>
          {rangeChange !== undefined && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              {rangeChange >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
              <span className="text-foreground">{signed(rangeChange)}</span>
              {!isPrivacyMode && rangeStartValue ? ` (${((rangeChange / Math.abs(rangeStartValue)) * 100).toFixed(1)}%)` : ""}
              {` ${RANGE_LABEL[range]}`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Toggle
                    variant="outline"
                    size="sm"
                    className="h-8 min-w-8 px-0"
                    pressed={byBucket}
                    onPressedChange={(on) => setView(on ? "buckets" : "total")}
                    aria-label="Show by bucket"
                  >
                    <Layers className="h-4 w-4" />
                  </Toggle>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{byBucket ? "Show total" : "Show by bucket"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Tabs value={range} onValueChange={(v) => setRange(v as NetWorthRange)}>
            <TabsList className="h-8">
              {RANGES.map((r) => (
                <TabsTrigger key={r} value={r} className="px-2.5 text-xs">
                  {r === "ALL" ? "All" : r}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {/* Grows to fill the card, which stretches to the budget card's height. */}
        <ChartContainer config={chartConfig} className="min-h-[180px] w-full flex-1 aspect-auto">
          <ComposedChart data={chartData} margin={{ left: 4, right: 8, top: 8 }}>
            {/* Axis is tight: "Oct 3" on short ranges, "Oct '26" on long ones. Tooltip shows the full date. */}
            <XAxis
              dataKey="ts"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={48}
              tickFormatter={(ts) =>
                range === "1M" || range === "3M"
                  ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: timezone })
                  : shortYearLabel(new Date(ts).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: timezone }))
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              ticks={yTicks}
              domain={[yTicks[0], yTicks[yTicks.length - 1]]}
              tickFormatter={(v) => formatAxisAmount(v, currency)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const ts = payload?.[0]?.payload?.ts;
                    return ts
                      ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: timezone })
                      : "";
                  }}
                  formatter={(v, name, item) => (
                    <span className="flex w-full items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                        {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                      </span>
                      <span className="font-mono tabular-nums">{formatAmount(Number(v), currency, false)}</span>
                    </span>
                  )}
                />
              }
            />
            {/* No fragments here: Recharts 2 only finds series that are direct children (or arrays) */}
            {byBucket && <ChartLegend content={<ChartLegendContent />} />}
            {byBucket &&
              BUCKETS.map((key) => (
                <Line key={key} dataKey={key} type="linear" stroke={`var(--color-${key})`} strokeWidth={1.5} dot={false} />
              ))}
            {byBucket && <Line dataKey="netWorth" type="linear" stroke="var(--foreground)" strokeWidth={2} dot={false} />}
            {!byBucket && (
              <Area dataKey="netWorth" type="linear" stroke="var(--color-netWorth)" strokeWidth={2} fill="var(--color-netWorth)" fillOpacity={0.12} dot={false} />
            )}
          </ComposedChart>
        </ChartContainer>

        {monthChange !== undefined && (
          <div className="flex justify-between border-t pt-3 text-sm font-medium">
            <span>This month</span>
            <span className="tabular-nums">{signed(monthChange)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
