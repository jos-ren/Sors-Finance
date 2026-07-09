"use client";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

/**
 * Sinking-fund meter for the Goals pages. Hero number is the contributed
 * amount (not "available") so pure savings goals read cleanly; spend and
 * overspend only surface as a secondary line when they're non-zero.
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
  const reached = hasTarget && contributed >= target;
  const overspent = available < 0;
  const dateLabel = targetDate
    ? new Date(targetDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;
  const showPace = !reached && requiredPerMonth != null && dateLabel;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-end justify-between gap-2">
        <span className={cn("font-semibold tabular-nums leading-none", size === "lg" ? "text-2xl" : "text-xl")}>
          {formatAmount(contributed)}
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {hasTarget ? `of ${formatAmount(target)}` : "saved"}
          </span>
        </span>
        {hasTarget && (
          <Badge variant={reached ? "default" : "secondary"} className="shrink-0 tabular-nums">
            {reached ? "Reached 🎉" : `${Math.round(contributedPct)}%`}
          </Badge>
        )}
      </div>

      <Progress value={contributedPct} className={size === "lg" ? "h-3" : "h-2"} />

      {spent > 0 && (
        <p className={cn("text-xs tabular-nums", overspent ? "font-medium text-destructive" : "text-muted-foreground")}>
          {formatAmount(spent)} spent
          {overspent && <> · {formatAmount(Math.abs(available))} over</>}
        </p>
      )}

      {showPace && (
        <p className="text-xs text-muted-foreground">
          {requiredPerMonth! > 0 ? (
            <>
              Needs <span className="font-medium text-foreground">{formatAmount(requiredPerMonth!)}/mo</span> to hit {dateLabel}
            </>
          ) : (
            <>On track for {dateLabel}</>
          )}
        </p>
      )}
    </div>
  );
}
