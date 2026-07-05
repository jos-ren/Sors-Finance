"use client";

import { useEffect, useRef } from "react";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";
import { useBudgetTreeInputs } from "./budget-tree-context";

/**
 * The planned-amount input for a budget item. Enter commits + moves to the next
 * input; Escape reverts to the last-saved value. Registered in the tree's input
 * registry so Enter can advance focus.
 */
export function PlannedInput({
  itemId,
  value,
  savedValue,
  onChange,
  onCommit,
  disabled = false,
  dirty = false,
}: {
  itemId: number;
  value: string;
  /** The saved planned amount, used for Escape-to-revert. */
  savedValue: number;
  onChange: (value: string) => void;
  onCommit: () => void;
  disabled?: boolean;
  dirty?: boolean;
}) {
  const { register, focusNext } = useBudgetTreeInputs();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    register(itemId, ref.current);
    return () => register(itemId, null);
  }, [itemId, register]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit();
      focusNext(itemId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onChange(savedValue ? savedValue.toFixed(2) : "");
      ref.current?.blur();
    }
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
      <CurrencyInput
        ref={ref}
        value={value}
        onChange={onChange}
        onBlur={onCommit}
        onKeyDown={handleKeyDown}
        placeholder="0.00"
        disabled={disabled}
        size="sm"
        className={cn(
          "h-8 w-24 pl-5 text-right text-sm tabular-nums",
          dirty && "border-primary ring-1 ring-primary/30"
        )}
      />
    </div>
  );
}
