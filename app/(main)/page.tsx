"use client";

import { useCallback, useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  PiggyBank,
  ArrowUpRight,
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useMonthlyTrend,
  useYearlyTotals,
  useSpendingByCategoryWithNames,
  useTransactionCount,
  useTransactionCountByPeriod,
  useAvailablePeriods,
  useAllTimeTotals,
  useAllTimeSpendingByCategory,
  useAllTimeMonthlyTrend,
  useBudgetHierarchy,
  useMonthlyByCategoryForYear,
  useAllTimeMonthlyByCategory,
  buildCategoryChartData,
} from "@/hooks";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { useSetPageHeader } from "@/contexts/page-header-context";

const areaChartConfig = {
  income: {
    label: "Income",
    color: "var(--alt-emerald)",
  },
  expenses: {
    label: "Expenses",
    color: "var(--chart-danger)",
  },
} satisfies ChartConfig;

// Distinct colors for pie chart categories
const PIE_COLORS = [
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

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  trend?: "up" | "down";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
          {trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // View mode: "all" or "year"
  const [viewMode, setViewMode] = useState<"all" | "year">("all");

  // Selection values
  const [selectedYearValue, setSelectedYearValue] = useState(currentYear);

  // Get available periods with data
  const availablePeriods = useAvailablePeriods();

  // Handle view mode change - reset to current period
  const handleViewModeChange = useCallback((mode: string) => {
    const newMode = mode as "all" | "year";
    setViewMode(newMode);
    if (newMode === "year") {
      // Default to current year or first available year
      const availableYear = availablePeriods?.years.includes(currentYear)
        ? currentYear
        : availablePeriods?.years[0] ?? currentYear;
      setSelectedYearValue(availableYear);
    }
    // "all" mode doesn't need any state changes
  }, [availablePeriods, currentYear]);

  // Parse the active selection based on view mode
  const selectedYear = viewMode === "all" ? undefined : selectedYearValue;

  // Privacy mode and user currency
  const { formatAmount } = usePrivacy();
  const userCurrency = useCurrency();

  // Memoized available years - use currentYear if no data exists
  const availableYears = useMemo(
    () => (availablePeriods?.years?.length ? availablePeriods.years : [currentYear]),
    [availablePeriods?.years, currentYear]
  );

  // Smaller date selector for sticky header - memoized to prevent infinite re-renders
  const headerDateSelector = useMemo(() => (
    <div className="flex items-center gap-1">
      <Tabs value={viewMode} onValueChange={handleViewModeChange}>
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs px-2 py-1">All</TabsTrigger>
          <TabsTrigger value="year" className="text-xs px-2 py-1">Year</TabsTrigger>
        </TabsList>
      </Tabs>
      {viewMode === "year" && (
        <Select value={`${selectedYearValue}`} onValueChange={(v) => setSelectedYearValue(parseInt(v))}>
          <SelectTrigger size="sm" className="w-[85px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((year) => (
              <SelectItem key={year} value={`${year}`}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  ), [viewMode, selectedYearValue, availableYears, handleViewModeChange]);

  // Set page header and get sentinel ref
  const sentinelRef = useSetPageHeader("Dashboard", headerDateSelector);

  // Fetch real data from Dexie - use selected date range
  const monthlyTrend = useMonthlyTrend(selectedYear ?? currentYear);
  const yearlyTotals = useYearlyTotals(selectedYear ?? currentYear);
  const spendingByCategory = useSpendingByCategoryWithNames(selectedYear ?? currentYear);
  const allTransactionCount = useTransactionCount();
  const yearTransactionCount = useTransactionCountByPeriod(selectedYear ?? currentYear);

  // All-time data hooks
  const allTimeTotals = useAllTimeTotals();
  const allTimeSpendingByCategory = useAllTimeSpendingByCategory();
  const allTimeMonthlyTrend = useAllTimeMonthlyTrend();

  // Monthly expenses breakdown chart - driven by the same All/Year picker as the rest of the page.
  // Spending aggregations are keyed by budget item; resolve names from the hierarchy.
  const budgetHierarchy = useBudgetHierarchy(true);
  const budgetItemNames = useMemo(
    () => budgetHierarchy?.items.map((i) => ({ id: i.id, name: i.name })),
    [budgetHierarchy]
  );
  const monthlyCategoryTrend = useMonthlyByCategoryForYear(selectedYearValue);
  const allTimeCategoryTrend = useAllTimeMonthlyByCategory(12);
  const activeCategoryTrend = viewMode === "all" ? allTimeCategoryTrend : monthlyCategoryTrend;
  const monthlyExpensesData = useMemo(
    () => buildCategoryChartData(activeCategoryTrend, budgetItemNames),
    [activeCategoryTrend, budgetItemNames]
  );

  // Use appropriate totals based on view mode
  const activeTotals = viewMode === "all" ? allTimeTotals : yearlyTotals;

  // Use appropriate spending data based on view mode
  const activeSpendingByCategory = viewMode === "all" ? allTimeSpendingByCategory : spendingByCategory;

  // Use appropriate trend data based on view mode
  const activeTrendData = viewMode === "all" ? allTimeMonthlyTrend : monthlyTrend;

  // Use appropriate transaction count based on view mode
  const activeTransactionCount = viewMode === "all" ? allTransactionCount : yearTransactionCount;

  // Transform spending data for charts
  const categorySpendingData = useMemo(() => {
    if (!activeSpendingByCategory) return [];

    return activeSpendingByCategory.map(s => ({
      category: s.categoryName,
      amount: s.amount,
    }));
  }, [activeSpendingByCategory]);

  // Create pie chart config dynamically
  const pieChartConfig = useMemo(() => {
    return categorySpendingData.reduce((acc, item, index) => {
      acc[item.category] = {
        label: item.category,
        color: PIE_COLORS[index % PIE_COLORS.length],
      };
      return acc;
    }, {} as ChartConfig);
  }, [categorySpendingData]);

  // Create monthly expenses chart config dynamically
  const monthlyExpensesChartConfig = useMemo(() => {
    if (!monthlyExpensesData) return {} as ChartConfig;
    return monthlyExpensesData.categorySeries.reduce((acc, item, index) => {
      acc[item.categoryName] = {
        label: item.categoryName,
        color: PIE_COLORS[index % PIE_COLORS.length],
      };
      return acc;
    }, {} as ChartConfig);
  }, [monthlyExpensesData]);

  // Calculate stats based on view mode (yearly or monthly totals)
  const totalIncome = activeTotals?.income ?? 0;
  const totalExpenses = activeTotals?.expenses ?? 0;
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;
  const topCategory = categorySpendingData.length > 0 ? categorySpendingData[0].category : "None";
  const totalCategorySpending = categorySpendingData.reduce((sum, item) => sum + item.amount, 0);

  // Format period name for display
  const periodName = viewMode === "all" ? "All Time" : `${selectedYear}`;
  const periodDescription = viewMode === "all" ? "All time" : "This year";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Your financial overview for {periodName}
          </p>
          <div ref={sentinelRef} className="h-0" />
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={handleViewModeChange}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="year">Year</TabsTrigger>
            </TabsList>
          </Tabs>
          {viewMode === "year" && (
            <Select value={`${selectedYearValue}`} onValueChange={(v) => setSelectedYearValue(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={`${year}`}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Income"
          value={formatAmount(totalIncome, userCurrency)}
          description={periodDescription}
          icon={DollarSign}
          trend={totalIncome > 0 ? "up" : undefined}
        />
        <StatCard
          title="Total Expenses"
          value={formatAmount(totalExpenses, userCurrency)}
          description={periodDescription}
          icon={Receipt}
          trend={totalExpenses > 0 ? "up" : undefined}
        />
        <StatCard
          title="Net Savings"
          value={formatAmount(netSavings, userCurrency)}
          description={`${savingsRate}% savings rate`}
          icon={PiggyBank}
          trend={netSavings > 0 ? "up" : netSavings < 0 ? "down" : undefined}
        />
        <StatCard
          title="Transactions"
          value={(activeTransactionCount ?? 0).toString()}
          description={`Top: ${topCategory}`}
          icon={ArrowUpRight}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Income vs Expenses Trend Chart */}
        <Card className="col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle>Income vs Expenses</CardTitle>
            <CardDescription>
              {viewMode === "all"
                ? "Monthly comparison across all time"
                : `Monthly comparison for ${selectedYear}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 pb-6">
            <ChartContainer config={areaChartConfig} className="h-[300px] w-full aspect-auto">
              <AreaChart
                data={activeTrendData || []}
                margin={{ left: 12, right: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="monthName"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => formatAmount(value, userCurrency, false)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" formatter={(value) => formatAmount(Number(value), userCurrency)} />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  dataKey="expenses"
                  type="natural"
                  fill="var(--chart-danger)"
                  fillOpacity={0.5}
                  stroke="var(--chart-danger)"
                  strokeOpacity={0.6}
                  stackId="b"
                />
                <Area
                  dataKey="income"
                  type="natural"
                  fill="var(--alt-emerald)"
                  fillOpacity={0.5}
                  stroke="var(--alt-emerald)"
                  stackId="a"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Monthly Expenses + Category Distribution (side by side, 2/3 + 1/3) */}
        <div className="col-span-2 grid grid-cols-3 gap-6 items-stretch">
          {/* Monthly Expenses by Category (stacked) */}
          <Card className="col-span-2 flex flex-col">
            <CardHeader>
              <CardTitle>Monthly Expenses</CardTitle>
              <CardDescription>
                {viewMode === "all"
                  ? "Monthly breakdown across all time"
                  : `Monthly breakdown for ${selectedYear}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 pb-6">
              {!monthlyExpensesData || monthlyExpensesData.categorySeries.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No spending data yet.
                </div>
              ) : (
                <ChartContainer config={monthlyExpensesChartConfig} className="h-[300px] w-full aspect-auto">
                  <BarChart data={monthlyExpensesData.chartRows} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) => formatAmount(value, userCurrency, false)}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          formatter={(value, name, item) => (
                            <div className="flex w-full flex-1 items-center gap-2">
                              <div
                                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                style={{ backgroundColor: item.color }}
                              />
                              <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                                <span className="text-muted-foreground">{name}</span>
                                <span className="text-foreground font-mono font-medium tabular-nums">
                                  {formatAmount(Number(value), userCurrency)}
                                </span>
                              </div>
                            </div>
                          )}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    {monthlyExpensesData.categorySeries.map((series, index) => (
                      <Bar
                        key={series.categoryName}
                        dataKey={series.categoryName}
                        stackId="expenses"
                        radius={index === monthlyExpensesData.categorySeries.length - 1 ? [4, 4, 0, 0] : 0}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                        fillOpacity={0.5}
                        stroke={PIE_COLORS[index % PIE_COLORS.length]}
                        strokeWidth={1.5}
                      />
                    ))}
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Category Pie Chart */}
          <Card className="col-span-1 flex flex-col">
            <CardHeader>
              <CardTitle>Category Distribution</CardTitle>
              <CardDescription>
                {periodName} · {categorySpendingData.length > 0 ? formatAmount(totalCategorySpending, userCurrency) : "No data"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 pb-6">
              {categorySpendingData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No spending data yet.
                </div>
              ) : (
                <ChartContainer config={pieChartConfig} className="h-[300px] w-full aspect-auto">
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          nameKey="category"
                          labelFormatter={(_, payload) => payload?.[0]?.name ?? ""}
                          formatter={(value) => {
                            const pct = totalCategorySpending > 0
                              ? ((Number(value) / totalCategorySpending) * 100).toFixed(1)
                              : "0";
                            return (
                              <span className="flex items-center justify-between gap-6 w-full">
                                <span>{formatAmount(Number(value), userCurrency)}</span>
                                <span className="text-muted-foreground">{pct}%</span>
                              </span>
                            );
                          }}
                        />
                      }
                    />
                    <Pie
                      data={categorySpendingData}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {categorySpendingData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                          fillOpacity={0.5}
                          stroke={PIE_COLORS[index % PIE_COLORS.length]}
                          strokeWidth={1.5}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  );
}
