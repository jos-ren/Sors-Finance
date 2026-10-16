"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, PiggyBank, TrendingUp, Home, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BucketType, useBucketTotal, usePortfolioAccounts, useNetWorthRange } from '@/hooks/use-database';
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { cn } from "@/lib/utils";

interface BucketCardProps {
  bucket: BucketType;
  className?: string;
}

const BUCKET_CONFIG: Record<BucketType, {
  icon: typeof PiggyBank;
  href: string;
  color: string;
  bgColor: string;
}> = {
  Savings: {
    icon: PiggyBank,
    href: "/portfolio/savings",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  Investments: {
    icon: TrendingUp,
    href: "/portfolio/investments",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  Assets: {
    icon: Home,
    href: "/portfolio/assets",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  Debt: {
    icon: CreditCard,
    href: "/portfolio/debt",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
};

const SNAPSHOT_FIELD = {
  Savings: "totalSavings",
  Investments: "totalInvestments",
  Assets: "totalAssets",
  Debt: "totalDebt",
} as const satisfies Record<BucketType, string>;

export function BucketCard({ bucket, className }: BucketCardProps) {
  const total = useBucketTotal(bucket);
  const accounts = usePortfolioAccounts(bucket);
  const { formatAmount } = usePrivacy();
  const userCurrency = useCurrency();
  const config = BUCKET_CONFIG[bucket];
  const Icon = config.icon;

  const accountCount = accounts?.length ?? 0;

  // Change since the start of this month: last snapshot before the 1st, else
  // the first one this month. Shares the Home net worth card's 3M fetch.
  const recent = useNetWorthRange("3M");
  const monthChange = useMemo(() => {
    if (!recent || recent.length === 0 || total === undefined) return undefined;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const before = recent.filter((s) => s.date < monthStart);
    const base = before.length > 0 ? before[before.length - 1] : recent.find((s) => s.date >= monthStart);
    return base ? total - base[SNAPSHOT_FIELD[bucket]] : undefined;
  }, [recent, total, bucket]);
  // For debt, going down is the good direction.
  const isGood = monthChange !== undefined && (bucket === "Debt" ? monthChange <= 0 : monthChange >= 0);

  return (
    <Card className={cn("group hover:shadow-md transition-shadow", className)}>
      <CardContent className="p-4">
        <div className={cn("p-2 rounded-lg w-fit", config.bgColor)}>
          <Icon className={cn("h-5 w-5", config.color)} />
        </div>
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">{bucket}</p>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {formatAmount(total ?? 0, userCurrency, false)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {monthChange !== undefined && Math.abs(monthChange) >= 0.005 && (
              <span className={cn("mr-1.5 font-medium", isGood ? "text-emerald-500" : "text-red-500")}>
                {monthChange >= 0 ? "+" : "−"}{formatAmount(Math.abs(monthChange), userCurrency, false)} this month ·
              </span>
            )}
            {accountCount} {accountCount === 1 ? "account" : "accounts"}
          </p>
        </div>
        <Button variant="link" className="p-0 h-auto mt-2 text-sm" asChild>
          <Link href={config.href}>
            View details <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
