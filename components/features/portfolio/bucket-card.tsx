"use client";

import Link from "next/link";
import { ArrowRight, PiggyBank, TrendingUp, Home, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BucketType, useBucketTotal, usePortfolioAccounts } from '@/hooks/use-database';
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { formatCurrency } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";

interface BucketCardProps {
  bucket: BucketType;
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

export function BucketCard({ bucket }: BucketCardProps) {
  const total = useBucketTotal(bucket);
  const accounts = usePortfolioAccounts(bucket);
  const { formatAmount } = usePrivacy();
  const userCurrency = useCurrency();
  const config = BUCKET_CONFIG[bucket];
  const Icon = config.icon;

  const accountCount = accounts?.length ?? 0;

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className={cn("p-2 rounded-lg w-fit", config.bgColor)}>
          <Icon className={cn("h-5 w-5", config.color)} />
        </div>
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">{bucket}</p>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {formatAmount(total ?? 0, userCurrency)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
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
