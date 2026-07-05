"use client";

import Link from "next/link";
import { MoreHorizontal, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { BudgetTreeItem } from "@/lib/budget/types";
import { PlannedInput } from "./planned-input";
import { GoalProgress } from "./goal-progress";

/**
 * A budget item row: name (+ goal microcopy) | Planned input | Actual (row
 * click drills) | remaining/progress | ⋯ menu. Planned inputs are the only
 * tabbable elements; the rest of the row is a drill-down link.
 */
export function BudgetItemRow({
  item,
  pendingValue,
  dirty,
  formatAmount,
  drillHref,
  onPlannedChange,
  onPlannedCommit,
  onOpenDetail,
}: {
  item: BudgetTreeItem;
  pendingValue: string | undefined;
  dirty: boolean;
  formatAmount: (n: number) => string;
  drillHref: string;
  onPlannedChange: (value: string) => void;
  onPlannedCommit: () => void;
  onOpenDetail: () => void;
}) {
  const isGoal = item.itemType === "goal";
  const inputValue = pendingValue !== undefined ? pendingValue : item.planned ? item.planned.toFixed(2) : "";
  const remaining = item.planned - item.actual;
  const over = remaining < 0;

  return (
    <div className="group flex items-center gap-3 py-1.5 pl-2 pr-1">
      {/* Name + drill target */}
      <Link href={drillHref} className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 truncate text-sm">
          {isGoal && <Target className="h-3.5 w-3.5 shrink-0 text-primary" />}
          <span className="truncate">{item.name}</span>
          {!item.isActive && (
            <span className="rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">archived</span>
          )}
        </span>
        {isGoal ? (
          <GoalProgress
            saved={item.cumulative}
            target={item.targetAmount}
            formatAmount={formatAmount}
            className="mt-0.5 max-w-[220px]"
          />
        ) : (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {formatAmount(item.actual)} spent
          </span>
        )}
      </Link>

      {/* Planned */}
      <PlannedInput
        itemId={item.id}
        value={inputValue}
        savedValue={item.planned}
        dirty={dirty}
        onChange={onPlannedChange}
        onCommit={onPlannedCommit}
      />

      {/* Remaining (expenses only) */}
      {!isGoal && (
        <span
          className={cn(
            "hidden w-24 text-right text-xs tabular-nums sm:block",
            over ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {over ? `-${formatAmount(Math.abs(remaining))}` : `${formatAmount(remaining)} left`}
        </span>
      )}

      {/* Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-60 group-hover:opacity-100">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onOpenDetail}>Item details…</DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={drillHref}>View transactions</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
