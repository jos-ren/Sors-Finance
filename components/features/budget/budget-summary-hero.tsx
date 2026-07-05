"use client";

import { useMemo } from "react";
import { TrendingUp, Wallet, CheckCircle2, ArrowDownCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { BudgetTree } from "@/lib/budget/types";

export interface AssignSuggestion {
  itemId: number;
  label: string; // "Group › Item"
}

/**
 * Available-to-Assign hero. Three stats (Actual Income | Total Budgeted (live) |
 * Available) with a zero-based status treatment:
 *   available == 0 → green "Every dollar assigned" + ring pulse
 *   available > 0  → lime "Assign remaining" popover of suggested targets
 *   available < 0  → red "reduce by $X" + focus chips on largest items
 */
export function BudgetSummaryHero({
  tree,
  formatAmount,
  suggestions,
  overspentChips,
  onAssignRemaining,
  onFocusItem,
}: {
  tree: BudgetTree;
  formatAmount: (n: number) => string;
  suggestions: AssignSuggestion[];
  overspentChips: AssignSuggestion[];
  onAssignRemaining: (itemId: number, amount: number) => void;
  onFocusItem: (itemId: number) => void;
}) {
  const { incomeActual, totalBudgeted, availableToAssign } = tree.summary;
  const state = useMemo<"zero" | "positive" | "negative">(() => {
    if (Math.abs(availableToAssign) < 0.005) return "zero";
    return availableToAssign > 0 ? "positive" : "negative";
  }, [availableToAssign]);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 shadow-sm transition-colors",
        state === "zero" && "border-primary/40",
        state === "negative" && "border-destructive/40"
      )}
    >
      <div className="grid grid-cols-3 gap-4">
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Actual Income" value={formatAmount(incomeActual)} />
        <Stat icon={<Wallet className="h-4 w-4" />} label="Total Budgeted" value={formatAmount(totalBudgeted)} live />
        <Stat
          label="Available to Assign"
          value={formatAmount(availableToAssign)}
          emphasis={state}
        />
      </div>

      <div className="mt-4 flex items-center gap-3 border-t pt-3">
        {state === "zero" && (
          <div
            key="zero"
            className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-primary animate-in fade-in"
          >
            <span className="relative flex h-5 w-5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40 [animation-iteration-count:2]" />
              <CheckCircle2 className="relative h-5 w-5" />
            </span>
            Every dollar assigned
          </div>
        )}

        {state === "positive" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" className="gap-1.5">
                Assign remaining {formatAmount(availableToAssign)}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <p className="px-2 pb-1.5 text-xs text-muted-foreground">Add {formatAmount(availableToAssign)} to…</p>
              <div className="flex flex-col">
                {suggestions.length === 0 && (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">No suggested targets</p>
                )}
                {suggestions.map((s) => (
                  <button
                    key={s.itemId}
                    onClick={() => onAssignRemaining(s.itemId, availableToAssign)}
                    className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {state === "negative" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <ArrowDownCircle className="h-4 w-4" />
              Reduce by {formatAmount(Math.abs(availableToAssign))}
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
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  live,
  emphasis,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  live?: boolean;
  emphasis?: "zero" | "positive" | "negative";
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
        {live && <span className="text-[10px] uppercase tracking-wide text-primary/70">live</span>}
      </span>
      <span
        className={cn(
          "text-2xl font-semibold tabular-nums",
          emphasis === "zero" && "text-primary",
          emphasis === "positive" && "text-primary",
          emphasis === "negative" && "text-destructive"
        )}
      >
        {value}
      </span>
    </div>
  );
}
