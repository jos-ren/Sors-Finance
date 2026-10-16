"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { YearlySummary } from "@/lib/budget/types";

/**
 * Read-only Yearly Totals: Σ planned / Σ actual / diff per category across 12
 * months, grouped. Archived categories that had activity show an "archived" badge.
 * Separately funded projects are listed after the groups, outside the
 * planned-vs-actual totals.
 */
export function YearlyTotalsView({
  summary,
  formatAmount,
}: {
  summary: YearlySummary;
  formatAmount: (n: number) => string;
}) {
  const plannedTotal = summary.plannedByMonth.reduce((a, b) => a + b, 0);
  const actualTotal = summary.actualByMonth.reduce((a, b) => a + b, 0);
  const incomeTotal = summary.incomeByMonth.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5 sm:grid-cols-4">
        <YearStat label="Income" value={formatAmount(incomeTotal)} />
        <YearStat label="Planned" value={formatAmount(plannedTotal)} />
        <YearStat label="Actual" value={formatAmount(actualTotal)} />
        <YearStat
          label="Planned − Actual"
          value={formatAmount(plannedTotal - actualTotal)}
          className={plannedTotal - actualTotal < 0 ? "text-destructive" : undefined}
        />
      </div>

      <div className="space-y-3">
        {summary.groups.map((group) => {
          const gPlanned = group.categories.reduce((a, c) => a + c.plannedTotal, 0);
          const gActual = group.categories.reduce((a, c) => a + c.actualTotal, 0);
          return (
            <div key={group.id} className="overflow-hidden rounded-lg border bg-card">
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="font-semibold">{group.name}</span>
                <span className="flex items-center gap-4 text-sm tabular-nums">
                  <span>{formatAmount(gPlanned)}</span>
                  <span className="text-muted-foreground">{formatAmount(gActual)}</span>
                </span>
              </div>
              <div className="border-t px-3 py-1.5">
                {group.categories.map((category) => {
                  const diff = category.plannedTotal - category.actualTotal;
                  return (
                    <div key={category.id} className="flex items-center justify-between py-1 text-sm">
                      <span className="flex items-center gap-1.5 truncate">
                        {category.name}
                        {!category.isActive && (
                          <span className="rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">archived</span>
                        )}
                      </span>
                      <span className="flex items-center gap-4 tabular-nums">
                        <span className="w-24 text-right">{formatAmount(category.plannedTotal)}</span>
                        <span className="w-24 text-right text-muted-foreground">{formatAmount(category.actualTotal)}</span>
                        <span className={cn("hidden w-24 text-right sm:block", diff < 0 && "text-destructive")}>
                          {formatAmount(diff)}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {summary.projects.length > 0 && (
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="font-semibold">Projects</span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatAmount(summary.projects.reduce((a, p) => a + p.total, 0))}
              </span>
            </div>
            <div className="border-t px-3 py-1.5">
              <p className="py-1 text-xs text-muted-foreground">Funded separately, not counted in the totals above.</p>
              {summary.projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between rounded py-1 text-sm hover:underline"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{formatAmount(p.total)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function YearStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("text-xl font-semibold tabular-nums", className)}>{value}</span>
    </div>
  );
}
