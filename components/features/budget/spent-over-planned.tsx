import { cn } from "@/lib/utils";

/**
 * "$actual / $planned" readout, no currency code. Only the actual (spent)
 * number takes the status color; the rest stays neutral.
 * TODO: currently has no entry point for category actions (menu was removed
 * pending a new home for it).
 */
export function SpentOverPlanned({
  actual,
  planned,
  formatAmountShort,
  actualClassName,
  className,
}: {
  actual: number;
  planned: number;
  formatAmountShort: (n: number) => string;
  /** Class applied only to the actual/spent number (e.g. status color). */
  actualClassName?: string;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      <span className={actualClassName}>{formatAmountShort(actual)}</span> / {formatAmountShort(planned)}
    </span>
  );
}
