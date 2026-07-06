"use client";

import Link from "next/link";
import { Target, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BudgetTreeCategory } from "@/lib/budget/types";
// import { GoalProgress } from "./goal-progress";

/**
 * A budget category row: expand chevron (only if it has transactions this
 * period) | name | total spent this period (read-only — planned amounts are
 * set in the Builder). Clicking the name/amount drills into the category;
 * the chevron toggles the nested transaction list without navigating.
 * TODO: no entry point for category actions right now (menu removed pending
 * a new home for it — onOpenDetail is unused until then).
 */
export function BudgetItemRow({
  item,
  formatAmountShort,
  drillHref,
  hasTransactions,
  isExpanded,
  onToggleExpand,
  onOpenDetail: _onOpenDetail,
}: {
  item: BudgetTreeCategory;
  formatAmountShort: (n: number) => string;
  drillHref: string;
  hasTransactions: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenDetail: () => void;
}) {
  const isGoal = item.itemType === "goal";

  return (
    <div className="flex items-center gap-1 py-1.5 pl-2 pr-2">
      {/* Sized/positioned to exactly match the group row's chevron (h-4 w-4,
          flush against the row's left padding, no extra centering box) so
          the depth-guide lines — which assume a fixed offset — line up
          under this chevron the same way they do under a group's. */}
      <button
        type="button"
        disabled={!hasTransactions}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleExpand();
        }}
        className={cn(
          "shrink-0 rounded text-muted-foreground",
          hasTransactions ? "hover:bg-accent" : "invisible"
        )}
        aria-label={isExpanded ? "Collapse transactions" : "Expand transactions"}
        aria-hidden={!hasTransactions}
      >
        <ChevronDown className={cn("h-4 w-4 transition-transform", !isExpanded && "-rotate-90")} />
      </button>

      <Link href={drillHref} className="group flex flex-1 items-center gap-3">
        {/* Name */}
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm">
          {isGoal && <Target className="h-3.5 w-3.5 shrink-0 text-primary" />}
          <span className="truncate">{item.name}</span>
          {!item.isActive && (
            <span className="rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">archived</span>
          )}
        </span>
        {/* {isGoal && (
          <GoalProgress
            saved={item.cumulative}
            target={item.targetAmount}
            formatAmount={formatAmountShort}
            className="mt-0.5 max-w-[220px]"
          />
        )} */}

        <span className="shrink-0 text-right text-sm tabular-nums text-muted-foreground">
          {formatAmountShort(item.actual)}
        </span>
      </Link>
    </div>
  );
}
