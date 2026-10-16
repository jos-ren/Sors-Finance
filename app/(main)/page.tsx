"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useHomeSummary, useAvailablePeriods } from "@/hooks";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { BudgetStatusCard } from "@/components/features/home/budget-status-card";
import { NetWorthCard } from "@/components/features/home/net-worth-card";
import { SummaryTiles } from "@/components/features/home/summary-tiles";
import { AttentionStrip } from "@/components/features/home/attention-strip";
import { TrendsSection } from "@/components/features/home/trends-section";

/**
 * Home: two questions at a glance. "Am I on track this month?" (budget card,
 * stepped by month) and "Is my net worth growing?" (range chips). Each card
 * owns its time range; there is no page-wide picker.
 * See docs/plans/home-dashboard-plan.md.
 */
export default function HomePage() {
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const summary = useHomeSummary(period.year, period.month);
  const availablePeriods = useAvailablePeriods();
  const sentinelRef = useSetPageHeader("Home");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Home</h1>
        <p className="text-muted-foreground">Are you on track this month, and is your net worth growing?</p>
        <div ref={sentinelRef} className="h-0" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] [&>*]:min-w-0">
        {summary ? (
          <BudgetStatusCard
            summary={summary}
            availableYears={availablePeriods?.years ?? [now.getFullYear()]}
            monthsByYear={availablePeriods?.monthsByYear}
            onMonthSelect={(year, month) => setPeriod({ year, month })}
          />
        ) : (
          <div className="flex h-[420px] items-center justify-center rounded-xl border">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <NetWorthCard />
      </div>

      {summary && <SummaryTiles summary={summary} />}
      {summary && <AttentionStrip summary={summary} />}

      <TrendsSection />
    </div>
  );
}
