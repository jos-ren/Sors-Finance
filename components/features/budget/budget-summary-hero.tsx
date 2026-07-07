"use client";

import { useMemo } from "react";
import { CheckCircle2, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BudgetTree } from "@/lib/budget/types";

export interface AssignSuggestion {
  itemId: number;
  label: string; // "Group › Item"
}

/**
 * On-budget hero, styled to match the builder's allocation meter: a single
 * mathematical sentence (Budgeted − Actual = Remaining) with a
 * progress bar along the bottom edge. This is a look-back page — the budget
 * was already assigned in the Builder — so the question here is "did I stay
 * within it", not "what's left to assign":
 *   remaining == 0 → green "Right on budget" + ring pulse
 *   remaining > 0  → informational, no action needed
 *   remaining < 0  → red "Overspent by $X" + focus chips on the worst offenders
 */
export function BudgetSummaryHero({
  tree,
  formatAmount,
  overspentChips,
  onFocusItem,
}: {
  tree: BudgetTree;
  formatAmount: (n: number) => string;
  overspentChips: AssignSuggestion[];
  onFocusItem: (itemId: number) => void;
}) {
  const { totalBudgeted, totalActual } = tree.summary;
  const remaining = totalBudgeted - totalActual;
  const state = useMemo<"zero" | "positive" | "negative">(() => {
    if (Math.abs(remaining) < 0.005) return "zero";
    return remaining > 0 ? "positive" : "negative";
  }, [remaining]);

  const pct = totalBudgeted > 0 ? Math.min(100, (totalActual / totalBudgeted) * 100) : totalActual > 0 ? 100 : 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm transition-colors",
        state === "zero" && "border-primary/40",
        state === "negative" && "border-destructive/40"
      )}
    >
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3 p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Budgeted</p>
          <p className="flex h-9 items-center text-2xl font-semibold tabular-nums">{formatAmount(totalBudgeted)}</p>
        </div>

        <span className="select-none pb-0.5 text-2xl font-semibold leading-9 text-muted-foreground">−</span>

        <div>
          <p className="text-xs font-medium text-muted-foreground">Actual</p>
          <p className="flex h-9 items-center text-2xl font-semibold tabular-nums">{formatAmount(totalActual)}</p>
        </div>

        <span className="select-none pb-0.5 text-2xl font-semibold leading-9 text-muted-foreground">=</span>

        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {state === "negative" ? "Overspent" : "Remaining"}
          </p>
          <p
            className={cn(
              "flex h-9 items-center text-2xl font-semibold tabular-nums",
              state === "negative" ? "text-destructive" : "text-primary"
            )}
          >
            {formatAmount(state === "negative" ? Math.abs(remaining) : remaining)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 pb-3">
        {state === "zero" && (
          <div className="flex items-center gap-2 text-xs font-medium text-primary animate-in fade-in">
            <span className="relative flex h-4 w-4 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40 [animation-iteration-count:2]" />
              <CheckCircle2 className="relative h-4 w-4" />
            </span>
            Right on budget
          </div>
        )}

        {state === "positive" && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <CheckCircle2 className="h-4 w-4" />
            {formatAmount(remaining)} left unspent
          </div>
        )}

        {state === "negative" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-destructive">
              <ArrowUpCircle className="h-4 w-4" />
              Overspent by {formatAmount(Math.abs(remaining))}
            </span>
            {overspentChips.map((c) => (
              <button
                key={c.itemId}
                onClick={() => onFocusItem(c.itemId)}
                className="rounded-full border border-destructive/40 px-2.5 py-0.5 text-xs text-destructive hover:bg-destructive/10"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-2 w-full bg-muted">
        <div
          className={cn(
            "h-full transition-[width] duration-300",
            state === "negative" && "bg-destructive",
            state === "zero" && "animate-pulse bg-primary",
            state === "positive" && "bg-foreground/50"
          )}
          style={{ width: `${state === "negative" ? 100 : pct}%` }}
        />
      </div>
    </div>
  );
}
