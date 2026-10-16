"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  useAllTimeMonthlyTrend,
  useAllTimeMonthlyByCategory,
  useBudgetHierarchy,
  buildCategoryChartData,
  rollUpCategoryTrendToGroups,
  usePersistentState,
} from "@/hooks";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { classifyCategory } from "@/lib/budget/classify";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Span = 3 | 6 | 12;
const SPANS: readonly Span[] = [3, 6, 12];

const GROUP_COLORS = [
  "var(--alt-blue)",
  "var(--alt-orange)",
  "var(--alt-emerald)",
  "var(--alt-fuchsia)",
  "var(--alt-cyan)",
  "var(--alt-amber)",
  "var(--alt-indigo)",
  "var(--alt-lime)",
  "var(--alt-pink)",
  "var(--alt-green)",
];

const flowConfig = {
  income: { label: "Money in", color: "var(--alt-emerald)" },
  expenses: { label: "Money out", color: "var(--chart-danger)" },
} satisfies ChartConfig;

/** Below-the-fold trends over a rolling window (not calendar years). */
export function TrendsSection() {
  const { formatAmount, formatAxisAmount } = usePrivacy();
  const currency = useCurrency();
  const [span, setSpan] = usePersistentState<Span>("sors-home-trends-span", 6, SPANS);

  const flow = useAllTimeMonthlyTrend();
  const hierarchy = useBudgetHierarchy(true);
  const byCategory = useAllTimeMonthlyByCategory();

  // The current month is partial: label it "so far" and fade its bars.
  const now = new Date();
  const currentLabel = `${MONTH_SHORT[now.getMonth()]} ${String(now.getFullYear()).slice(2)}`;
  const soFar = (label: string) => (label === currentLabel ? `${label} (so far)` : label);

  const flowData = useMemo(
    () =>
      (flow ?? []).slice(-span).map((r) => {
        const label = `${r.monthName} ${String(r.year).slice(2)}`;
        return { label: soFar(label), income: r.income, expenses: r.expenses, partial: label === currentLabel };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow, span, currentLabel]
  );

  // Spending only: goal categories are saving (transfers), not money spent.
  const groupData = useMemo(() => {
    if (!byCategory || !hierarchy) return undefined;
    const savingIds = new Set(
      hierarchy.subcategories.filter((c) => classifyCategory(c) === "saving").map((c) => c.id)
    );
    const spendingRows = byCategory.slice(-span).map((row) => ({
      // Category rows are labelled "Oct 2026"; shorten to match the flow chart.
      label: soFar(row.label.replace(/ (\d{2})(\d{2})$/, " $2")),
      categoryTotals: Object.fromEntries(
        Object.entries(row.categoryTotals).filter(([id]) => !savingIds.has(Number(id)))
      ),
    }));
    const grouped = rollUpCategoryTrendToGroups(spendingRows, hierarchy);
    return buildCategoryChartData(grouped?.rows, grouped?.groups);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCategory, hierarchy, span, currentLabel]);

  const groupConfig = useMemo(
    () =>
      (groupData?.categorySeries ?? []).reduce((acc, s, i) => {
        acc[s.categoryName] = { label: s.categoryName, color: GROUP_COLORS[i % GROUP_COLORS.length] };
        return acc;
      }, {} as ChartConfig),
    [groupData]
  );

  const moneyTooltip = (
    <ChartTooltipContent
      formatter={(value, name, item) => (
        <div className="flex w-full items-center gap-2">
          <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
          <div className="flex flex-1 justify-between gap-4">
            <span className="text-muted-foreground">{(flowConfig as ChartConfig)[name as string]?.label ?? name}</span>
            <span className="font-mono tabular-nums">{formatAmount(Number(value), currency, false)}</span>
          </div>
        </div>
      )}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Trends</h2>
        <Tabs value={String(span)} onValueChange={(v) => setSpan(Number(v) as Span)}>
          <TabsList className="h-8">
            <TabsTrigger value="3" className="px-2.5 text-xs">3M</TabsTrigger>
            <TabsTrigger value="6" className="px-2.5 text-xs">6M</TabsTrigger>
            <TabsTrigger value="12" className="px-2.5 text-xs">12M</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Money in vs out</CardTitle>
            <CardDescription>All accounts, excluding transfers you marked Excluded</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={flowConfig} className="h-[240px] w-full aspect-auto">
              <BarChart data={flowData} margin={{ left: 4, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v) => formatAxisAmount(v, currency)} />
                <ChartTooltip cursor={false} content={moneyTooltip} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="income" fill="var(--color-income)" radius={[3, 3, 0, 0]}>
                  {flowData.map((d) => (
                    <Cell key={d.label} fillOpacity={d.partial ? 0.25 : 0.6} />
                  ))}
                </Bar>
                <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[3, 3, 0, 0]}>
                  {flowData.map((d) => (
                    <Cell key={d.label} fillOpacity={d.partial ? 0.25 : 0.6} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spending by group</CardTitle>
            <CardDescription>Spending and bills, excluding transfers to goals</CardDescription>
          </CardHeader>
          <CardContent>
            {!groupData || groupData.categorySeries.length === 0 ? (
              <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">No spending data yet.</div>
            ) : (
              <ChartContainer config={groupConfig} className="h-[240px] w-full aspect-auto">
                <BarChart data={groupData.chartRows} margin={{ left: 4, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                  <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v) => formatAxisAmount(v, currency)} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent formatter={(value, name) => (
                      <span className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">{name}</span>
                        <span className="font-mono tabular-nums">{formatAmount(Number(value), currency, false)}</span>
                      </span>
                    )} />}
                  />
                  <ChartLegend content={<ChartLegendContent className="flex-wrap gap-y-1" />} />
                  {groupData.categorySeries.map((s, i) => (
                    <Bar
                      key={s.categoryName}
                      dataKey={s.categoryName}
                      stackId="groups"
                      fill={GROUP_COLORS[i % GROUP_COLORS.length]}
                      radius={i === groupData.categorySeries.length - 1 ? [3, 3, 0, 0] : 0}
                    >
                      {groupData.chartRows.map((row) => (
                        <Cell key={String(row.month)} fillOpacity={String(row.month).endsWith("(so far)") ? 0.25 : 0.6} />
                      ))}
                    </Bar>
                  ))}
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
