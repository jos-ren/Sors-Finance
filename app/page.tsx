"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useSnapshot } from "@/lib/snapshot-context";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  PiggyBank,
  ArrowUpRight,
  Calendar,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarProps,
  ComposedChart,
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
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useMonthlyTrend,
  useDailyTrend,
  useMonthlyTotals,
  useYearlyTotals,
  useBudgetWithSpending,
  useSpendingByCategoryWithNames,
  useTransactionCount,
  useTransactionCountByPeriod,
  useAvailablePeriods,
  useAllTimeTotals,
  useAllTimeSpendingByCategory,
  useAllTimeMonthlyTrend,
} from "@/lib/hooks";
import { usePrivacy } from "@/lib/privacy-context";
import { useSetPageHeader } from "@/lib/page-header-context";
import { cn } from "@/lib/utils";

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

const barChartConfig = {
  amount: {
    label: "Spent",
    color: "var(--chart-fill)",
  },
  budget: {
    label: "Budget",
    color: "var(--chart-marker)",
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

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

// Month names for display
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Month picker component - grid-based month selection with year navigation
function MonthPicker({
  size = "default",
  selectedMonth,
  onMonthSelect,
  availableYears,
  availableMonthsByYear,
}: {
  size?: "default" | "sm";
  selectedMonth: { year: number; month: number };
  onMonthSelect: (year: number, month: number) => void;
  availableYears: number[];
  availableMonthsByYear?: Map<number, number[]>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayYear, setDisplayYear] = useState(selectedMonth.year);

  const selectedMonthDisplay = `${MONTH_NAMES_SHORT[selectedMonth.month]} ${selectedMonth.year}`;

  // Current month/year should always be allowed
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Generate year options - include current year even if no data
  const yearOptions = availableYears.length > 0
    ? [...new Set([...availableYears, currentYear])].sort((a, b) => b - a)
    : Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Check if a month is enabled (has data OR is current month)
  const isMonthEnabled = (year: number, month: number) => {
    // Always allow current month
    if (year === currentYear && month === currentMonth) return true;
    // If no data loaded yet, allow all
    if (!availableMonthsByYear) return true;
    // Check if month has data
    return availableMonthsByYear.get(year)?.includes(month) ?? false;
  };

  // Reset display year when popover opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setDisplayYear(selectedMonth.year);
    }
    setIsOpen(open);
  };

  const handleMonthClick = (monthIndex: number) => {
    onMonthSelect(displayYear, monthIndex);
    setIsOpen(false);
  };

  const canGoPrev = yearOptions.includes(displayYear - 1);
  const canGoNext = yearOptions.includes(displayYear + 1);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={size === "sm" ? "sm" : "default"}
          className={cn(
            "justify-start text-left font-normal",
            size === "sm" ? "w-[110px] h-8 text-xs" : "w-[140px]"
          )}
        >
          <Calendar className={size === "sm" ? "mr-1 h-3 w-3" : "mr-2 h-4 w-4"} />
          {selectedMonthDisplay}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        {/* Year selector header */}
        <div className="flex items-center justify-between p-3 border-b">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canGoPrev}
            onClick={() => setDisplayYear(y => y - 1)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Button>
          <Select
            value={displayYear.toString()}
            onValueChange={(v) => setDisplayYear(parseInt(v))}
          >
            <SelectTrigger className="w-[100px] h-7 border-0 font-semibold focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canGoNext}
            onClick={() => setDisplayYear(y => y + 1)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </Button>
        </div>
        {/* Month grid */}
        <div className="grid grid-cols-3 gap-1 p-3">
          {MONTH_NAMES_SHORT.map((name, index) => {
            const isSelected = selectedMonth.year === displayYear && selectedMonth.month === index;
            const isEnabled = isMonthEnabled(displayYear, index);
            return (
              <Button
                key={name}
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                className={cn("h-9", !isEnabled && "opacity-40")}
                disabled={!isEnabled}
                onClick={() => handleMonthClick(index)}
              >
                {name}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function DashboardPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // View mode: "all", "year", or "month"
  const [viewMode, setViewMode] = useState<"all" | "year" | "month">("all");

  // Auto-snapshot logic - ensure daily snapshot exists (runs in background with rate limiting)
  const { startBackgroundSnapshot } = useSnapshot();
  const autoSnapshotAttempted = useRef(false);

  useEffect(() => {
    if (autoSnapshotAttempted.current) return;
    autoSnapshotAttempted.current = true;

    // Start background snapshot - it will check if one already exists today
    startBackgroundSnapshot();
  }, [startBackgroundSnapshot]);

  // Selection values
  const [selectedYearValue, setSelectedYearValue] = useState(currentYear);
  const [selectedMonthValue, setSelectedMonthValue] = useState({ year: currentYear, month: currentMonth });

  // Get available periods with data
  const availablePeriods = useAvailablePeriods();

  // Handle view mode change - reset to current period
  const handleViewModeChange = useCallback((mode: string) => {
    const newMode = mode as "all" | "year" | "month";
    setViewMode(newMode);
    if (newMode === "year") {
      // Default to current year or first available year
      const availableYear = availablePeriods?.years.includes(currentYear)
        ? currentYear
        : availablePeriods?.years[0] ?? currentYear;
      setSelectedYearValue(availableYear);
    } else if (newMode === "month") {
      // Default to current month or first available month
      const hasCurrentMonth = availablePeriods?.monthsByYear.get(currentYear)?.includes(currentMonth);
      if (hasCurrentMonth) {
        setSelectedMonthValue({ year: currentYear, month: currentMonth });
      } else if (availablePeriods?.years[0]) {
        const year = availablePeriods.years[0];
        const months = availablePeriods.monthsByYear.get(year);
        if (months && months.length > 0) {
          setSelectedMonthValue({ year, month: months[months.length - 1] });
        }
      }
    }
    // "all" mode doesn't need any state changes
  }, [availablePeriods, currentYear, currentMonth]);

  // Parse the active selection based on view mode
  const { selectedYear, selectedMonth } = useMemo(() => {
    if (viewMode === "all") {
      return {
        selectedYear: undefined,
        selectedMonth: undefined,
      };
    } else if (viewMode === "year") {
      return {
        selectedYear: selectedYearValue,
        selectedMonth: undefined,
      };
    } else {
      return {
        selectedYear: selectedMonthValue.year,
        selectedMonth: selectedMonthValue.month,
      };
    }
  }, [viewMode, selectedYearValue, selectedMonthValue]);

  // Privacy mode
  const { formatAmount } = usePrivacy();

  // Handler for month selection
  const handleMonthSelect = useCallback((year: number, month: number) => {
    setSelectedMonthValue({ year, month });
  }, []);

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
          <TabsTrigger value="month" className="text-xs px-2 py-1">Month</TabsTrigger>
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
      {viewMode === "month" && (
        <MonthPicker
          size="sm"
          selectedMonth={selectedMonthValue}
          onMonthSelect={handleMonthSelect}
          availableYears={availableYears}
          availableMonthsByYear={availablePeriods?.monthsByYear}
        />
      )}
    </div>
  ), [viewMode, selectedYearValue, availableYears, selectedMonthValue, handleMonthSelect, handleViewModeChange, availablePeriods?.years, availablePeriods?.monthsByYear, currentYear]);

  // Set page header and get sentinel ref
  const sentinelRef = useSetPageHeader("Dashboard", headerDateSelector);

  // Fetch real data from Dexie - use selected date range
  const monthlyTrend = useMonthlyTrend(selectedYear ?? currentYear);
  const dailyTrend = useDailyTrend(selectedYear ?? currentYear, selectedMonth ?? currentMonth);
  const yearlyTotals = useYearlyTotals(selectedYear ?? currentYear);
  const monthlyTotals = useMonthlyTotals(selectedYear ?? currentYear, selectedMonth ?? currentMonth);
  const budgetWithSpending = useBudgetWithSpending(selectedYear ?? currentYear, selectedMonth ?? currentMonth);
  const spendingByCategory = useSpendingByCategoryWithNames(selectedYear ?? currentYear, selectedMonth);
  const allTransactionCount = useTransactionCount();
  const yearTransactionCount = useTransactionCountByPeriod(selectedYear ?? currentYear);
  const monthTransactionCount = useTransactionCountByPeriod(selectedYear ?? currentYear, selectedMonth ?? currentMonth);

  // All-time data hooks
  const allTimeTotals = useAllTimeTotals();
  const allTimeSpendingByCategory = useAllTimeSpendingByCategory();
  const allTimeMonthlyTrend = useAllTimeMonthlyTrend();

  // Use appropriate totals based on view mode
  const activeTotals = viewMode === "all" ? allTimeTotals : viewMode === "year" ? yearlyTotals : monthlyTotals;

  // Use appropriate spending data based on view mode
  const activeSpendingByCategory = viewMode === "all" ? allTimeSpendingByCategory : spendingByCategory;

  // Use appropriate trend data based on view mode
  const activeTrendData = viewMode === "all" ? allTimeMonthlyTrend : viewMode === "year" ? monthlyTrend : dailyTrend;

  // Use appropriate transaction count based on view mode
  const activeTransactionCount = viewMode === "all" ? allTransactionCount : viewMode === "year" ? yearTransactionCount : monthTransactionCount;

  // Transform spending data for charts (use direct spending, not budget-dependent)
  const categorySpendingData = useMemo(() => {
    if (!activeSpendingByCategory) return [];

    // Create a map of budget amounts by category ID for reference
    const budgetMap = new Map<number, number>();
    if (budgetWithSpending) {
      budgetWithSpending.forEach(b => {
        budgetMap.set(b.categoryId, b.amount);
      });
    }

    return activeSpendingByCategory.map(s => ({
      category: s.categoryName,
      amount: s.amount,
      budget: budgetMap.get(s.categoryId) || 0,
    }));
  }, [activeSpendingByCategory, budgetWithSpending]);

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

  // Calculate stats based on view mode (yearly or monthly totals)
  const totalIncome = activeTotals?.income ?? 0;
  const totalExpenses = activeTotals?.expenses ?? 0;
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;
  const topCategory = categorySpendingData.length > 0 ? categorySpendingData[0].category : "None";
  const totalCategorySpending = categorySpendingData.reduce((sum, item) => sum + item.amount, 0);

  // Format period name for display
  const periodName = viewMode === "all"
    ? "All Time"
    : selectedMonth !== undefined
      ? `${MONTH_NAMES[selectedMonth]} ${selectedYear}`
      : `${selectedYear}`;
  const periodDescription = viewMode === "all" ? "All time" : selectedMonth !== undefined ? "This month" : "This year";

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
              <TabsTrigger value="month">Month</TabsTrigger>
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
          {viewMode === "month" && (
            <MonthPicker
              selectedMonth={selectedMonthValue}
              onMonthSelect={handleMonthSelect}
              availableYears={availableYears}
              availableMonthsByYear={availablePeriods?.monthsByYear}
            />
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Income"
          value={formatAmount(totalIncome, formatCurrency)}
          description={periodDescription}
          icon={DollarSign}
          trend={totalIncome > 0 ? "up" : undefined}
        />
        <StatCard
          title="Total Expenses"
          value={formatAmount(totalExpenses, formatCurrency)}
          description={periodDescription}
          icon={Receipt}
          trend={totalExpenses > 0 ? "up" : undefined}
        />
        <StatCard
          title="Net Savings"
          value={formatAmount(netSavings, formatCurrency)}
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
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Income vs Expenses</CardTitle>
            <CardDescription>
              {viewMode === "all"
                ? "Monthly comparison across all time"
                : viewMode === "year"
                  ? `Monthly comparison for ${selectedYear}`
                  : `Daily comparison for ${periodName}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={areaChartConfig} className="h-[300px] w-full">
              <AreaChart
                data={activeTrendData || []}
                margin={{ left: 12, right: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey={viewMode === "month" ? "dayName" : "monthName"}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={viewMode === "month" ? "preserveStartEnd" : 0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => formatAmount(value, (v) => `$${v}`)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" formatter={(value) => formatAmount(Number(value), formatCurrency)} />}
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

        {/* Category Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>{periodName} spending breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {categorySpendingData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No spending data yet.
              </div>
            ) : (
            <ChartContainer config={barChartConfig} className="h-[300px] w-full">
              <ComposedChart
                data={categorySpendingData}
                layout="vertical"
                margin={{ left: 0, right: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <YAxis
                  dataKey="category"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={100}
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => formatAmount(value, (v) => `$${v}`)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent formatter={(value) => formatAmount(Number(value), formatCurrency)} />}
                />
                <Bar
                  dataKey="amount"
                  radius={4}
                  name="Spent"
                  shape={(props: BarProps) => {
                    const { x, y, width, height, index } = props as {
                      x?: number;
                      y?: number;
                      width?: number;
                      height?: number;
                      index?: number;
                    };
                    if (x === undefined || y === undefined || width === undefined || height === undefined || index === undefined) return <></>;

                    const entry = categorySpendingData[index];
                    if (!entry) return <></>;

                    const budget = entry.budget || 0;
                    const isOverBudget = budget > 0 && entry.amount > budget;
                    const hasBudget = budget > 0;
                    // Use matching color from PIE_COLORS palette
                    const categoryColor = PIE_COLORS[index % PIE_COLORS.length];

                    // width corresponds to 'amount', calculate budget width proportionally
                    const budgetWidth = hasBudget ? (budget / entry.amount) * width : width;

                    return (
                      <g>
                        {hasBudget && (
                          /* Neutral background up to budget */
                          <rect
                            x={x}
                            y={y}
                            width={Math.min(budgetWidth, width)}
                            height={height}
                            rx={4}
                            ry={4}
                            fill="var(--muted-foreground)"
                            fillOpacity={0.2}
                          />
                        )}
                        {isOverBudget ? (
                          <>
                            {/* Within budget portion - category color with glass effect */}
                            <rect
                              x={x}
                              y={y}
                              width={budgetWidth + 4}
                              height={height}
                              rx={4}
                              ry={4}
                              fill={categoryColor}
                              fillOpacity={0.5}
                              stroke={categoryColor}
                              strokeWidth={1.5}
                            />
                            {/* Over budget portion - red danger with glass effect */}
                            <rect
                              x={x + budgetWidth}
                              y={y}
                              width={width - budgetWidth}
                              height={height}
                              rx={4}
                              ry={4}
                              fill="var(--chart-danger)"
                              fillOpacity={0.5}
                              stroke="var(--chart-danger)"
                              strokeWidth={1.5}
                            />
                          </>
                        ) : (
                          /* Within budget: category color with glass effect */
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            rx={4}
                            ry={4}
                            fill={categoryColor}
                            fillOpacity={0.5}
                            stroke={categoryColor}
                            strokeWidth={1.5}
                          />
                        )}
                      </g>
                    );
                  }}
                />
              </ComposedChart>
            </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Category Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Category Distribution</CardTitle>
            <CardDescription>{periodName} percentage breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {categorySpendingData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No spending data yet.
              </div>
            ) : (
              <>
                <ChartContainer config={pieChartConfig} className="h-[300px] w-full">
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel formatter={(value) => formatAmount(Number(value), formatCurrency)} />}
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
                    <ChartLegend
                      content={<ChartLegendContent nameKey="category" />}
                      className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
                    />
                  </PieChart>
                </ChartContainer>
                <div className="mt-4 text-center">
                  <p className="text-2xl font-bold">{formatAmount(totalCategorySpending, formatCurrency)}</p>
                  <p className="text-sm text-muted-foreground">Total spending in {periodName}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
