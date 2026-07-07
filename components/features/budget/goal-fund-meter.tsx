"use client";

import { cn } from "@/lib/utils";

/**
 * Segmented sinking-fund meter for the Goals pages (richer than the compact
 * GoalProgress used in budget rows). The bar fills by `contributed / target`
 * (monotonic — spending never regresses it); a darker inset segment within
 * the filled portion shows how much of the fund has been spent. `available`
 * is the headline figure.
 */
export function GoalFundMeter({
  contributed,
  spent,
  available,
  target,
  requiredPerMonth,
  targetDate,
  formatAmount,
  size = "sm",
  className,
}: {
  contributed: number;
  spent: number;
  available: number;
  target: number | null;
  /** From GoalSummary pace; null when no date/target or past due. */
  requiredPerMonth?: number | null;
  /** Epoch ms deadline, for the pace line. */
  targetDate?: number | null;
  formatAmount: (n: number) => string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const hasTarget = target != null && target > 0;
  const contributedPct = hasTarget ? Math.min(100, Math.max(0, (contributed / target) * 100)) : contributed > 0 ? 100 : 0;
  const spentPct = hasTarget
    ? Math.min(contributedPct, Math.max(0, (spent / target) * 100))
    : contributed > 0
      ? Math.min(100, Math.max(0, (spent / contributed) * 100))
      : 0;
  const reached = hasTarget && contributed >= target;
  const dateLabel = targetDate
    ? new Date(targetDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("font-semibold tabular-nums", size === "lg" ? "text-2xl" : "text-base")}>
          {formatAmount(available)}
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">available</span>
        </span>
        {reached && <span className="text-xs font-medium text-primary">Reached 🎉</span>}
      </div>

      <div className={cn("relative w-full overflow-hidden rounded-full bg-muted", size === "lg" ? "h-3" : "h-2")}>
        {/* Contributed fill */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out",
            reached ? "bg-primary" : "bg-primary/70"
          )}
          style={{ width: `${contributedPct}%` }}
        />
        {/* Spent inset (darker, within the filled portion) */}
        {spentPct > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary/35 transition-[width] duration-500 ease-out"
            style={{ width: `${spentPct}%` }}
          />
        )}
      </div>

      <p className="text-[11px] text-muted-foreground tabular-nums">
        {hasTarget ? (
          <>
            {formatAmount(contributed)} of {formatAmount(target)} · {Math.round(contributedPct)}%
          </>
        ) : (
          <>{formatAmount(contributed)} contributed</>
        )}
        {spent > 0 && <> · {formatAmount(spent)} spent</>}
      </p>

      {!reached && requiredPerMonth != null && dateLabel && (
        <p className="text-[11px] text-muted-foreground">
          {requiredPerMonth > 0 ? (
            <>
              Needs <span className="font-medium text-foreground">{formatAmount(requiredPerMonth)}/mo</span> to hit {dateLabel}
            </>
          ) : (
            <>On track for {dateLabel}</>
          )}
        </p>
      )}
    </div>
  );
}
