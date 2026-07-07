"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sticky allocation meter for the budget builder, rendered as a single
 * mathematical sentence: Expected Income − Assigned = Left to Assign.
 * All three numbers share the same size/weight; colour (not scale) marks the
 * result. Income is click-to-edit — plain text with a pencil icon that swaps
 * to a borderless inline input at the same size. A full-width progress bar
 * runs along the card's bottom edge.
 */
export function AllocationMeter({
  income,
  assigned,
  formatAmount,
  onIncomeChange,
}: {
  income: number;
  assigned: number;
  formatAmount: (n: number) => string;
  onIncomeChange: (amount: number) => Promise<unknown> | void;
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
        "sticky top-2 z-30 overflow-hidden rounded-xl border bg-card/95 shadow-sm backdrop-blur transition-colors",
        state === "zero" && "border-primary/40",
        state === "negative" && "border-destructive/40"
      )}
    >
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3 p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Expected Income</p>
          <IncomeValue income={income} onIncomeChange={onIncomeChange} formatAmount={formatAmount} />
        </div>

        <span className="select-none pb-0.5 text-2xl font-semibold leading-9 text-muted-foreground">−</span>

        <div>
          <p className="text-xs font-medium text-muted-foreground">Assigned</p>
          <p className="flex h-9 items-center text-2xl font-semibold tabular-nums">{formatAmount(assigned)}</p>
        </div>

        <span className="select-none pb-0.5 text-2xl font-semibold leading-9 text-muted-foreground">=</span>

        <div>
          <p className="text-xs font-medium text-muted-foreground">Left to Assign</p>
          <p
            className={cn(
              "flex h-9 items-center text-2xl font-semibold tabular-nums",
              state === "negative" ? "text-destructive" : "text-primary"
            )}
          >
            {formatAmount(left)}
          </p>
        </div>
      </div>

      {state === "zero" && (
        <p className="flex items-center gap-1.5 px-4 pb-3 text-xs font-medium text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" /> Every dollar assigned
        </p>
      )}
      {state === "negative" && (
        <p className="px-4 pb-3 text-xs font-medium text-destructive">
          Over-assigned by {formatAmount(Math.abs(left))} — reduce allocations.
        </p>
      )}

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

/** Income as plain text (matching the other numbers) with a subtle pencil
 *  icon; clicking swaps in a borderless inline input at the same type size. */
function IncomeValue({
  income,
  onIncomeChange,
  formatAmount,
}: {
  income: number;
  onIncomeChange: (amount: number) => Promise<unknown> | void;
  formatAmount: (n: number) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const escaped = useRef(false);

  if (!editing) {
    return (
      <button
        type="button"
        className="group -mx-1 flex h-9 cursor-text items-center gap-1.5 rounded-md px-1 transition-colors hover:bg-accent/60"
        onClick={() => {
          setDraft(income > 0 ? income.toFixed(2) : "");
          escaped.current = false;
          setEditing(true);
        }}
        aria-label="Edit expected income"
      >
        <span className="text-2xl font-semibold tabular-nums group-hover:opacity-80">
          {income > 0 ? formatAmount(income) : <span className="text-muted-foreground">Set income</span>}
        </span>
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  const commit = async () => {
    const cancelled = escaped.current;
    escaped.current = false;
    setEditing(false);
    if (cancelled) return;
    const amount = parseFloat(draft);
    if (!isNaN(amount) && amount !== income) await onIncomeChange(amount);
  };

  return (
    <div className="flex h-9 items-center gap-0.5">
      <span className="select-none text-2xl font-semibold text-muted-foreground">$</span>
      <input
        autoFocus
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || /^\d*\.?\d*$/.test(v)) setDraft(v);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            escaped.current = true;
            e.currentTarget.blur();
          }
        }}
        placeholder="0.00"
        className="w-32 bg-transparent text-2xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/50"
        aria-label="Expected income"
      />
    </div>
  );
}
