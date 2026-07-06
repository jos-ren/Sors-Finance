"use client";

import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sticky top-down allocation meter for the budget builder: total income, how
 * much is assigned (live), and how much is left to assign — with a progress bar
 * and zero-based status colouring.
 */
export function AllocationMeter({
  income,
  assigned,
  formatAmount,
}: {
  income: number;
  assigned: number;
  formatAmount: (n: number) => string;
}) {
  const left = income - assigned;
  const state = useMemo<"zero" | "positive" | "negative">(() => {
    if (Math.abs(left) < 0.005) return "zero";
    return left > 0 ? "positive" : "negative";
  }, [left]);

  const pct = income > 0 ? Math.min(100, (assigned / income) * 100) : assigned > 0 ? 100 : 0;

  return (
    <div
      className={cn(
        "sticky top-2 z-30 rounded-xl border bg-card/95 p-4 shadow-sm backdrop-blur transition-colors",
        state === "zero" && "border-primary/40",
        state === "negative" && "border-destructive/40"
      )}
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Left to Assign</p>
          <p
            className={cn(
              "text-3xl font-semibold tabular-nums",
              state === "zero" && "text-primary",
              state === "positive" && "text-primary",
              state === "negative" && "text-destructive"
            )}
          >
            {formatAmount(left)}
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="text-sm font-medium tabular-nums">{formatAmount(income)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Assigned</p>
            <p className="text-sm font-medium tabular-nums">{formatAmount(assigned)}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            state === "negative" ? "bg-destructive" : "bg-primary"
          )}
          style={{ width: `${state === "negative" ? 100 : pct}%` }}
        />
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs">
        {state === "zero" && (
          <span className="flex items-center gap-1.5 font-medium text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" /> Every dollar assigned
          </span>
        )}
        {state === "positive" && <span className="text-muted-foreground">Assign the remaining {formatAmount(left)} below.</span>}
        {state === "negative" && <span className="font-medium text-destructive">Over-assigned by {formatAmount(Math.abs(left))} — reduce allocations.</span>}
      </p>
    </div>
  );
}
