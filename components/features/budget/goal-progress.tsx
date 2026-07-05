"use client";

import { cn } from "@/lib/utils";

/**
 * Goal progress bar + "$3,200 of $5,000 · 64%" microcopy for goal items.
 * `saved` is the lifetime cumulative net; `target` the optional target.
 */
export function GoalProgress({
  saved,
  target,
  formatAmount,
  className,
}: {
  saved: number;
  target: number | null;
  formatAmount: (n: number) => string;
  className?: string;
}) {
  const pct = target && target > 0 ? Math.min(100, Math.max(0, (saved / target) * 100)) : 0;
  const reached = target != null && target > 0 && saved >= target;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            reached ? "bg-primary" : "bg-primary/70"
          )}
          style={{ width: `${target && target > 0 ? pct : saved > 0 ? 100 : 0}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground tabular-nums">
        {target && target > 0 ? (
          <>
            {formatAmount(saved)} of {formatAmount(target)} · {Math.round(pct)}%
            {reached && <span className="ml-1 font-medium text-primary">Reached 🎉</span>}
          </>
        ) : (
          <>{formatAmount(saved)} saved</>
        )}
      </p>
    </div>
  );
}
