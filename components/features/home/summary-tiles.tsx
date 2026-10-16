"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import type { HomeSummary } from "@/lib/budget/home-types";

function Tile({ label, value, detail, valueClassName }: { label: string; value: string; detail: React.ReactNode; valueClassName?: string }) {
  return (
    <Card className="py-4">
      <CardContent className="space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-bold tabular-nums", valueClassName)}>{value}</p>
        <div className="text-sm text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Income, bills paid, and what was kept this month. Saved = income − bills −
 * spending − separately funded project spending. For the current month the
 * Saved tile leads with the month-end projection, since bills land early and
 * pay arrives through the month.
 */
export function SummaryTiles({ summary }: { summary: HomeSummary }) {
  const { formatAmount, isPrivacyMode } = usePrivacy();
  const currency = useCurrency();
  const { bills, saving } = summary;
  const soFar = summary.isCurrentMonth ? " so far" : "";
  const projected = saving.projected;
  const headlineSaved = projected ? projected.saved : saving.saved;
  const keptInCash = headlineSaved - saving.toSavings;
  const monthEnd = new Date(summary.year, summary.month, summary.daysInMonth).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const billsLeft = Math.max(0, bills.budget - bills.paid);
  // "$1,605 to Japan trip" when separately funded projects spent this month
  const projectLine =
    summary.projects.length === 1
      ? `${formatAmount(saving.toProjects, currency, false)} to ${summary.projects[0].name}`
      : summary.projects.length > 1
        ? `${formatAmount(saving.toProjects, currency, false)} to ${summary.projects.length} projects`
        : null;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Tile
        label={`Income${soFar}`}
        value={formatAmount(saving.income, currency, false)}
        detail="Into the Income category this month"
      />
      <Tile
        label="Bills"
        value={`${formatAmount(bills.paid, currency, false)}`}
        detail={
          bills.budget > 0
            ? billsLeft > 0
              ? `of ${formatAmount(bills.budget, currency, false)} · ${formatAmount(billsLeft, currency, false)} still to pay`
              : `of ${formatAmount(bills.budget, currency, false)} · all paid`
            : "No recurring bills budgeted"
        }
      />
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              {projected ? (
                <Tile
                  label={`On track to save by ${monthEnd}`}
                  value={formatAmount(projected.saved, currency, false)}
                  valueClassName={projected.saved < 0 ? "text-red-600 dark:text-red-400" : undefined}
                  detail={
                    projectLine
                      ? `${formatAmount(saving.saved, currency, false)} so far · ${projectLine}`
                      : `${formatAmount(saving.saved, currency, false)} so far · income from ${projected.incomeSource === "planned" ? "your plan" : "last month"}`
                  }
                />
              ) : (
                <Tile
                  label="Saved"
                  value={formatAmount(saving.saved, currency, false)}
                  valueClassName={saving.saved < 0 ? "text-red-600 dark:text-red-400" : undefined}
                  detail={
                    [
                      saving.income > 0 && !isPrivacyMode ? `${Math.round(saving.rate * 100)}% of income` : null,
                      projectLine,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Income minus bills and spending"
                  }
                />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[260px]">
            {projected && "Projected: "}
            {formatAmount(saving.toSavings, currency, false)} planned to savings
            {keptInCash >= 0
              ? `, ${formatAmount(keptInCash, currency, false)} kept in cash`
              : `, ${formatAmount(-keptInCash, currency, false)} short of the savings plan`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
