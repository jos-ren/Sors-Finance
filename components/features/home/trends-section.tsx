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
import { shortYearLabel } from "@/lib/utils/formatters";
import { useProjects } from "@/hooks/use-projects";
import { projectHatchFill, projectHatchPattern } from "@/components/features/projects/project-hatch";

/** Chart key for a project's series, kept apart from group names. */
const projectKey = (id: number) => `__project_${id}`;

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
  const projects = useProjects();

  // The current month is partial: label it "so far" and fade its bars.
  const now = new Date();
  const currentLabel = `${MONTH_SHORT[now.getMonth()]} ${now.getFullYear()}`;
  const soFar = (label: string) => (label === currentLabel ? `${label} (so far)` : label);

  const flowData = useMemo(
    () =>
      (flow ?? []).slice(-span).map((r) => {
        const label = `${r.monthName} ${r.year}`;
        return { label: soFar(label), income: r.income, expenses: r.expenses, partial: label === currentLabel };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow, span, currentLabel]
  );

  // Spending only: saving categories are transfers, not money spent.
  const groupData = useMemo(() => {
    if (!byCategory || !hierarchy) return undefined;
    const savingIds = new Set(
      hierarchy.subcategories.filter((c) => classifyCategory(c) === "saving").map((c) => c.id)
    );
    const spendingRows = byCategory.slice(-span).map((row) => ({
      // Category rows are labelled "Oct 2026", matching the flow chart.
      label: soFar(row.label),
      categoryTotals: Object.fromEntries(
        Object.entries(row.categoryTotals).filter(([id]) => !savingIds.has(Number(id)))
      ),
    }));
    const grouped = rollUpCategoryTrendToGroups(
      byCategory.slice(-span).map((row, i) => ({ ...spendingRows[i], projectTotals: row.projectTotals })),
      hierarchy
    );
    const base = buildCategoryChartData(grouped?.rows, grouped?.groups);
    if (!grouped || !base) return undefined;

    // Separately funded projects stack on top, one striped series each
    const totals = new Map<number, number>();
    for (const r of grouped.rows) {
      for (const [id, amount] of Object.entries(r.projectTotals ?? {})) {
        totals.set(Number(id), (totals.get(Number(id)) ?? 0) + amount);
      }
    }
    const projectById = new Map((projects ?? []).map((p) => [p.id, p]));
    const projectSeries = [...totals.entries()]
      .filter(([id, total]) => total > 0 && projectById.has(id))
      .map(([id]) => ({ id, name: projectById.get(id)!.name, color: projectById.get(id)!.color }));
    const chartRows = base.chartRows.map((row, i) => ({
      ...row,
      ...Object.fromEntries(
        projectSeries.map((p) => [projectKey(p.id), Math.max(0, grouped.rows[i].projectTotals?.[p.id] ?? 0)])
      ),
    }));
    return { chartRows, categorySeries: base.categorySeries, projectSeries };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCategory, hierarchy, projects, span, currentLabel]);

  const groupConfig = useMemo<ChartConfig>(
    () => ({
        ...(groupData?.categorySeries ?? []).reduce((acc, s, i) => {
          acc[s.categoryName] = { label: s.categoryName, color: GROUP_COLORS[i % GROUP_COLORS.length] };
          return acc;
        }, {} as ChartConfig),
        ...(groupData?.projectSeries ?? []).reduce((acc, p) => {
          acc[projectKey(p.id)] = { label: p.name, color: p.color };
          return acc;
        }, {} as ChartConfig),
    }),
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
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} tickFormatter={shortYearLabel} />
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
            <CardDescription>Spending and bills, excluding transfers to savings. Striped segments are projects funded separately.</CardDescription>
          </CardHeader>
          <CardContent>
            {!groupData || groupData.categorySeries.length === 0 ? (
              <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">No spending data yet.</div>
            ) : (
              <ChartContainer config={groupConfig} className="h-[240px] w-full aspect-auto">
                <BarChart data={groupData.chartRows} margin={{ left: 4, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} tickFormatter={shortYearLabel} />
                  <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v) => formatAxisAmount(v, currency)} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent formatter={(value, name) => (
                      <span className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">{groupConfig[String(name)]?.label ?? name}</span>
                        <span className="font-mono tabular-nums">{formatAmount(Number(value), currency, false)}</span>
                      </span>
                    )} />}
                  />
                  <ChartLegend content={<ChartLegendContent className="flex-wrap gap-y-1" />} />
                  <defs>{groupData.projectSeries.map((p) => projectHatchPattern("trends", p))}</defs>
                  {groupData.categorySeries.map((s, i) => (
                    <Bar
                      key={s.categoryName}
                      dataKey={s.categoryName}
                      stackId="groups"
                      fill={GROUP_COLORS[i % GROUP_COLORS.length]}
                      radius={i === groupData.categorySeries.length - 1 && groupData.projectSeries.length === 0 ? [3, 3, 0, 0] : 0}
                    >
                      {groupData.chartRows.map((row) => (
                        <Cell key={String(row.month)} fillOpacity={String(row.month).endsWith("(so far)") ? 0.25 : 0.6} />
                      ))}
                    </Bar>
                  ))}
                  {groupData.projectSeries.map((p, i) => (
                    <Bar
                      key={p.id}
                      dataKey={projectKey(p.id)}
                      stackId="groups"
                      fill={projectHatchFill("trends", p.id)}
                      radius={i === groupData.projectSeries.length - 1 ? [3, 3, 0, 0] : 0}
                    >
                      {groupData.chartRows.map((row) => (
                        <Cell key={String(row.month)} fillOpacity={String(row.month).endsWith("(so far)") ? 0.4 : 1} />
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
