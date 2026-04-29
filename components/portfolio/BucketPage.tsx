"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, PiggyBank, TrendingUp, Home, CreditCard } from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";
import { Button } from "@/components/ui/button";
import {
  BucketType,
  usePortfolioAccounts,
  useBucketTotal,
} from "@/lib/hooks/useDatabase";
import { usePrivacy } from "@/lib/privacy-context";
import { useCurrency } from "@/lib/settings-context";

import { useSetPageHeader } from "@/lib/page-header-context";
import { AccountSection, AddAccountDialog, ApiKeyBanner } from "@/components/portfolio";
import { PlaidSyncButton } from "@/components/plaid/PlaidSyncButton";
import { PlaidSyncBanner } from "@/components/plaid/PlaidSyncBanner";
import { SectionHeader, RowGroup } from "@/components/ui/section";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface BucketPageProps {
  bucket: BucketType;
  description: string;
}

const BUCKET_CONFIG: Record<BucketType, {
  icon: typeof PiggyBank;
  color: string;
  bg: string;
}> = {
  Savings:     { icon: PiggyBank,  color: "text-emerald-500", bg: "bg-emerald-500/10" },
  Investments: { icon: TrendingUp, color: "text-blue-500",    bg: "bg-blue-500/10" },
  Assets:      { icon: Home,       color: "text-amber-500",   bg: "bg-amber-500/10" },
  Debt:        { icon: CreditCard, color: "text-red-500",     bg: "bg-red-500/10" },
};

export function BucketPage({ bucket, description }: BucketPageProps) {
  const [showAddAccount, setShowAddAccount] = useState(false);
  const { formatAmount } = usePrivacy();
  const userCurrency = useCurrency();
  const accounts = usePortfolioAccounts(bucket);
  const total = useBucketTotal(bucket);
  const config = BUCKET_CONFIG[bucket];
  const Icon = config.icon;

  // Plaid sync banner state
  const [syncResult, setSyncResult] = useState<{
    accountsUpdated: number;
    accountsFailed: number;
    pricesUpdated: number;
    pricesFailed: number;
    errors: string[];
    priceErrors: Array<{ ticker: string; itemName: string; error: string }>;
    syncedAccounts: Array<{ accountId: string; name: string; balance: number }>;
    syncedPrices: Array<{ ticker: string; itemName: string; price: number; currency: string }>;
  } | null>(null);

  // Header actions
  const headerActions = useMemo(() => (
    <div className="flex gap-2">
      <PlaidSyncButton onSyncComplete={setSyncResult} />
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
          <Breadcrumb className="mb-2">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/portfolio">Portfolio</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{bucket}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center gap-3">
            <IconBadge size="xl" radius="xl" className={config.bg}>
              <Icon className={`h-6 w-6 ${config.color}`} />
            </IconBadge>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{bucket}</h1>
              <p className="text-muted-foreground">{description}</p>
            </div>
          </div>
          <div ref={sentinelRef} className="h-0" />
        </div>
        <div className="flex gap-2">
          <PlaidSyncButton onSyncComplete={setSyncResult} />
          <Button size="sm" onClick={() => setShowAddAccount(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Plaid Sync Banner */}
      {syncResult && (
        <PlaidSyncBanner
          accountsUpdated={syncResult.accountsUpdated}
          accountsFailed={syncResult.accountsFailed}
          pricesUpdated={syncResult.pricesUpdated}
          pricesFailed={syncResult.pricesFailed}
          errors={syncResult.errors}
          priceErrors={syncResult.priceErrors}
          syncedAccounts={syncResult.syncedAccounts}
          syncedPrices={syncResult.syncedPrices}
          onDismiss={() => setSyncResult(null)}
        />
      )}

      {/* Total */}
      <div className="text-lg">
        Total: <span className="font-bold text-2xl">{formatAmount(total ?? 0, userCurrency)}</span>
      </div>

      {/* API Key Banner for Investments */}
      {bucket === "Investments" && <ApiKeyBanner />}

      {/* Accounts */}
      {accounts && accounts.length > 0 ? (
        <div>
          <SectionHeader label="Accounts" />
          <RowGroup>
            {accounts.map((account) => (
              <AccountSection key={account.id} account={account} />
            ))}
          </RowGroup>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <IconBadge size="xl" radius="xl" className={`mx-auto mb-4 ${config.bg} opacity-60`}>
            <Icon className={`h-6 w-6 ${config.color}`} />
          </IconBadge>
          <p className="text-lg font-medium">No accounts yet</p>
          <p className="text-sm mt-1">Create an account to start tracking your {bucket.toLowerCase()}.</p>
        </div>
      )}

      {showAddAccount && (
        <AddAccountDialog
          open={showAddAccount}
          onOpenChange={setShowAddAccount}
          bucket={bucket}
        />
      )}
    </div>
  );
}
