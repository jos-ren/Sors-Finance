"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Area, Bar, Cell, ComposedChart, Line, ReferenceDot, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { PeriodNavigator } from "@/components/features/budget/period-navigator";
import { CardTitleLink } from "@/components/features/home/card-title-link";
import { cn } from "@/lib/utils";
import { niceTicks } from "@/lib/utils/chart-ticks";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import type { HomeSummary } from "@/lib/budget/home-types";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const paceConfig = {
  actual: { label: "Spent", color: "var(--alt-blue)" },
  pace: { label: "Budget pace", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

const historyConfig = {
  spent: { label: "Spent", color: "var(--alt-emerald)" },
  budget: { label: "Budget", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

/**
 * "Am I on track?" — left to spend, this month's spending vs the
 * budget pace, and the last 12 months on/over budget. Spending only: bills and
 * goal transfers are excluded (see lib/budget/classify.ts).
 */
export function BudgetStatusCard({
  summary,
  availableYears,
  monthsByYear,
  onMonthSelect,
}: {
  summary: HomeSummary;
  availableYears: number[];
  monthsByYear?: Map<number, number[]>;
  onMonthSelect: (year: number, month: number) => void;
}) {
  const { formatAmount, formatAxisAmount } = usePrivacy();
  const router = useRouter();
  const budgetHref = (year: number, month: number) => `/budget?year=${year}&month=${month}`;
  const currency = useCurrency();
  const { spending, daysInMonth, elapsedDays, history } = summary;
  const left = spending.budget - spending.spent;

  const paceData = useMemo(
    () =>
      spending.cumulativeByDay.map((value, i) => ({
        day: i + 1,
        actual: i < elapsedDays ? value : null,
        pace: (spending.budget * (i + 1)) / daysInMonth,
      })),
    [spending, elapsedDays, daysInMonth]
  );

  const paceTicks = useMemo(
    () => niceTicks(0, Math.max(spending.budget, ...spending.cumulativeByDay.slice(0, elapsedDays), 1), 6),
    [spending, elapsedDays]
  );

  const historyData = useMemo(
    () =>
      history.map((h) => ({
        label: MONTH_SHORT[h.month],
        full: `${MONTH_NAMES[h.month]} ${h.year}`,
        year: h.year,
        month: h.month,
        spent: h.spent,
        budget: h.budget,
        over: h.budget > 0 && h.spent > h.budget,
      })),
    [history]
  );
  const budgetedMonths = history.filter((h) => h.budget > 0);
  const onBudget = budgetedMonths.filter((h) => h.spent <= h.budget).length;

  const todayValue = elapsedDays > 0 ? spending.cumulativeByDay[elapsedDays - 1] : 0;
  const daysLeft = daysInMonth - elapsedDays;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0">
          <CardTitleLink href={budgetHref(summary.year, summary.month)}>{MONTH_NAMES[summary.month]} spending</CardTitleLink>
          <p className={cn("mt-1 text-3xl font-bold tabular-nums", left < 0 && "text-red-600 dark:text-red-400")}>
            {left >= 0 ? `${formatAmount(left, currency, false)} left` : `${formatAmount(-left, currency, false)} over`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatAmount(spending.spent, currency, false)} spent of {formatAmount(spending.budget, currency, false)}
            {summary.isCurrentMonth && ` · ${daysLeft} ${daysLeft === 1 ? "day" : "days"} to go`}
          </p>
        </div>
        <div className="shrink-0">
          <PeriodNavigator
            viewMode="month"
            selectedMonth={{ year: summary.year, month: summary.month }}
            selectedYear={summary.year}
            availableYears={availableYears}
            availableMonthsByYear={monthsByYear}
            onMonthSelect={onMonthSelect}
            onYearChange={() => {}}
          />
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-6">
        <ChartContainer config={paceConfig} className="h-[180px] w-full aspect-auto">
          <ComposedChart data={paceData} margin={{ left: 4, right: 12, top: 8 }}>
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              ticks={[1, daysInMonth]}
              tickFormatter={(d) => `${MONTH_SHORT[summary.month]} ${d}`}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              ticks={paceTicks}
              domain={[paceTicks[0], paceTicks[paceTicks.length - 1]]}
              tickFormatter={(v) => formatAxisAmount(v, currency)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => `${MONTH_SHORT[summary.month]} ${payload?.[0]?.payload?.day ?? ""}`}
                  formatter={(value, name) => (
                    <span className="flex w-full justify-between gap-4">
                      <span className="text-muted-foreground">{paceConfig[name as keyof typeof paceConfig]?.label}</span>
                      <span className="font-mono tabular-nums">{formatAmount(Number(value), currency, false)}</span>
                    </span>
                  )}
                />
              }
            />
            <Line dataKey="pace" type="linear" stroke="var(--color-pace)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
            <Area
              dataKey="actual"
              type="linear"
              stroke="var(--color-actual)"
              strokeWidth={2}
              fill="var(--color-actual)"
              fillOpacity={0.12}
              connectNulls={false}
            />
            {elapsedDays > 0 && elapsedDays < daysInMonth && (
              <ReferenceDot x={elapsedDays} y={todayValue} r={4} fill="var(--alt-blue)" stroke="none" />
            )}
          </ComposedChart>
        </ChartContainer>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm font-medium">Previous months</p>
            <p className="text-sm text-muted-foreground">
              {budgetedMonths.length > 0 ? `${onBudget} of ${budgetedMonths.length} on budget` : "No budgets set"}
            </p>
          </div>
          <ChartContainer config={historyConfig} className="h-[110px] w-full aspect-auto">
            <ComposedChart data={historyData} margin={{ left: 4, right: 12 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} interval={0} fontSize={11} />
              <YAxis hide />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload;
                      if (!row) return "";
                      return row.over
                        ? `${row.full} · ${formatAmount(row.spent - row.budget, currency, false)} over`
                        : row.full;
                    }}
                    formatter={(value, name) => (
                      <span className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">{historyConfig[name as keyof typeof historyConfig]?.label}</span>
                        <span className="font-mono tabular-nums">{formatAmount(Number(value), currency, false)}</span>
                      </span>
                    )}
                  />
                }
              />
              <Bar
                dataKey="spent"
                radius={[3, 3, 0, 0]}
                className="cursor-pointer"
                onClick={(data) => {
                  const row = data?.payload as { year?: number; month?: number } | undefined;
                  if (row?.year !== undefined && row.month !== undefined) router.push(budgetHref(row.year, row.month));
                }}
              >
                {historyData.map((h, i) => (
                  <Cell key={i} fill={h.over ? "var(--alt-red)" : "var(--alt-emerald)"} fillOpacity={0.7} />
                ))}
              </Bar>
              <Line dataKey="budget" type="step" stroke="var(--color-budget)" strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
