"use client";

import { Target } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";
import type { BudgetTreeItem } from "@/lib/budget/types";

/**
 * A builder allocation row: name + % of income + a distribute slider + a $
 * input. The slider's max is the item's current planned plus whatever is left
 * to assign, so dragging right consumes the pool and dragging left returns to it.
 */
export function AllocationItemRow({
  item,
  income,
  leftToAssign,
  pendingValue,
  dirty,
  formatAmount,
  onChange,
}: {
  item: BudgetTreeItem;
  income: number;
  leftToAssign: number;
  pendingValue: string | undefined;
  dirty: boolean;
  formatAmount: (n: number) => string;
  onChange: (value: string) => void;
}) {
  const planned = item.planned; // effective (pending already overlaid upstream)
  const inputValue = pendingValue !== undefined ? pendingValue : planned ? planned.toFixed(2) : "";
  const sliderMax = Math.max(planned + Math.max(0, leftToAssign), planned, 100);
  const pctOfIncome = income > 0 ? (planned / income) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex min-w-0 flex-[2] items-center gap-1.5">
        {item.itemType === "goal" && <Target className="h-3.5 w-3.5 shrink-0 text-primary" />}
        <span className="truncate text-sm">{item.name}</span>
        {income > 0 && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{pctOfIncome.toFixed(0)}%</span>
        )}
      </div>

      <div className="flex-1">
        <Slider
          value={[planned]}
          min={0}
          max={sliderMax}
          step={5}
          onValueChange={([v]) => onChange(String(v))}
          aria-label={`Allocate to ${item.name}`}
        />
      </div>

      <div className="relative w-28 shrink-0">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
        <CurrencyInput
          value={inputValue}
          onChange={onChange}
          placeholder="0.00"
          size="sm"
          className={cn("h-8 pl-5 text-right text-sm tabular-nums", dirty && "border-primary ring-1 ring-primary/30")}
        />
      </div>
    </div>
  );
}
