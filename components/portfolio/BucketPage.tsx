"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, PiggyBank, TrendingUp, Home, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BucketType,
  usePortfolioAccounts,
  useBucketTotal,
} from "@/lib/hooks/useDatabase";
import { usePrivacy } from "@/lib/privacy-context";
import { useSetPageHeader } from "@/lib/page-header-context";
import { AccountSection, AddAccountDialog, ApiKeyBanner } from "@/components/portfolio";
import { PlaidSyncButton } from "@/components/plaid/PlaidSyncButton";

interface BucketPageProps {
  bucket: BucketType;
  description: string;
}

const BUCKET_CONFIG: Record<BucketType, {
  icon: typeof PiggyBank;
  color: string;
}> = {
  Savings: { icon: PiggyBank, color: "text-emerald-500" },
  Investments: { icon: TrendingUp, color: "text-blue-500" },
  Assets: { icon: Home, color: "text-amber-500" },
  Debt: { icon: CreditCard, color: "text-red-500" },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function BucketPage({ bucket, description }: BucketPageProps) {
  const [showAddAccount, setShowAddAccount] = useState(false);
  const { formatAmount } = usePrivacy();
  const accounts = usePortfolioAccounts(bucket);
  const total = useBucketTotal(bucket);
  const config = BUCKET_CONFIG[bucket];
  const Icon = config.icon;

  // Header actions
  const headerActions = useMemo(() => (
    <div className="flex gap-2">
      <PlaidSyncButton />
      <Button size="sm" onClick={() => setShowAddAccount(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Add Account
      </Button>
    </div>
  ), []);

  const sentinelRef = useSetPageHeader(bucket, headerActions);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <Link href="/portfolio">
                <ArrowLeft className="h-4 w-4" />
                Portfolio
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Icon className={`h-8 w-8 ${config.color}`} />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{bucket}</h1>
              <p className="text-muted-foreground">{description}</p>
            </div>
          </div>
          <div ref={sentinelRef} className="h-0" />
        </div>
        <div className="flex gap-2">
          <PlaidSyncButton />
          <Button size="sm" onClick={() => setShowAddAccount(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Total */}
      <div className="text-lg">
        Total: <span className="font-bold text-2xl">{formatAmount(total ?? 0, formatCurrency)}</span>
      </div>

      {/* API Key Banner for Investments */}
      {bucket === "Investments" && <ApiKeyBanner />}

      {/* Accounts */}
      <div className="space-y-4">
        {accounts && accounts.length > 0 ? (
          accounts.map((account) => (
            <AccountSection key={account.id} account={account} />
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Icon className={`h-12 w-12 mx-auto mb-4 ${config.color} opacity-50`} />
            <p className="text-lg font-medium">No accounts yet</p>
            <p className="text-sm mt-1">Create an account to start tracking your {bucket.toLowerCase()}.</p>
            <Button className="mt-4" onClick={() => setShowAddAccount(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </div>
        )}
      </div>

      <AddAccountDialog
        open={showAddAccount}
        onOpenChange={setShowAddAccount}
        bucket={bucket}
      />
    </div>
  );
}
