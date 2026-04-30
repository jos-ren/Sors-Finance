"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoCard } from "@/components/ui/info-card";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";

interface PlaidSyncBannerProps {
  accountsUpdated: number;
  accountsFailed: number;
  pricesUpdated?: number;
  pricesFailed?: number;
  errors: string[];
  priceErrors?: Array<{
    ticker: string;
    itemName: string;
    error: string;
  }>;
  syncedAccounts?: Array<{
    accountId: string;
    name: string;
    balance: number;
  }>;
  syncedPrices?: Array<{
    ticker: string;
    itemName: string;
    price: number;
    currency: string;
  }>;
  onDismiss: () => void;
}

export function PlaidSyncBanner({
  accountsUpdated,
  accountsFailed,
  pricesUpdated = 0,
  pricesFailed = 0,
  errors,
  priceErrors = [],
  syncedAccounts = [],
  syncedPrices = [],
  onDismiss,
}: PlaidSyncBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const userCurrency = useCurrency();
  const { formatAmount } = usePrivacy();

  const hasErrors = accountsFailed > 0 || pricesFailed > 0;
  const hasLoginErrors = errors.some(
    (err) =>
      err.includes("login details") ||
      err.includes("credentials") ||
      err.includes("required user action")
  );

  const totalUpdated = accountsUpdated + pricesUpdated;
  const totalFailed = accountsFailed + pricesFailed;

  if (totalUpdated === 0 && totalFailed === 0) {
    return null;
  }

  const hasDetails =
    syncedAccounts.length > 0 ||
    syncedPrices.length > 0 ||
    errors.length > 0 ||
    priceErrors.length > 0;

  // Build summary parts
  const summaryParts: string[] = [];
  if (accountsUpdated > 0)
    summaryParts.push(
      `${accountsUpdated} account${accountsUpdated === 1 ? "" : "s"} synced`
    );
  if (pricesUpdated > 0)
    summaryParts.push(
      `${pricesUpdated} price${pricesUpdated === 1 ? "" : "s"} updated`
    );
  if (accountsFailed > 0)
    summaryParts.push(
      `${accountsFailed} account${accountsFailed === 1 ? "" : "s"} failed`
    );
  if (pricesFailed > 0)
    summaryParts.push(
      `${pricesFailed} price${pricesFailed === 1 ? "" : "s"} failed`
    );

  return (
    <InfoCard
      variant={hasErrors ? "warning" : "success"}
      title={hasErrors ? "Sync Partially Complete" : "Sync Complete"}
      onClick={hasDetails ? () => setExpanded(!expanded) : undefined}
      action={
        <div className="flex items-center gap-1">
          {hasLoginErrors && (
            <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
              <Link href="/settings/plaid">
                Fix Connections
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onDismiss}
            className="h-7 text-xs"
          >
            Dismiss
          </Button>
          {hasDetails && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  expanded && "rotate-180"
                )}
              />
            </Button>
          )}
        </div>
      }
      footer={expanded ? (
        <div className="space-y-3 border-t border-border/50 pt-3">
          {/* Synced Accounts */}
          {syncedAccounts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">
                Accounts Synced
              </p>
              <div className="space-y-1 pl-1">
                {syncedAccounts.map((account, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between text-xs"
                  >
                    <span>{account.name}</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {formatAmount(account.balance, userCurrency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Synced Prices */}
          {syncedPrices.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">
                Prices Updated
              </p>
              <div className="space-y-1 pl-1">
                {syncedPrices.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between text-xs"
                  >
                    <span>
                      {item.ticker} — {item.itemName}
                    </span>
                    <span className="font-mono tabular-nums text-foreground">
                      {formatAmount(item.price, item.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account Errors */}
          {errors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-destructive mb-1.5">
                Account Errors
              </p>
              <ul className="space-y-0.5 pl-1">
                {errors.map((error, idx) => (
                  <li key={idx} className="text-xs">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Price Errors */}
          {priceErrors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-destructive mb-1.5">
                Price Errors
              </p>
              <ul className="space-y-0.5 pl-1">
                {priceErrors.map((item, idx) => (
                  <li key={idx} className="text-xs">
                    <span>
                      {item.ticker} — {item.itemName}:
                    </span>{" "}
                    <span className="text-destructive">{item.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Login re-auth notice */}
          {hasLoginErrors && (
            <p className="text-xs text-muted-foreground pt-1">
              Some banks require re-authentication. Use the &quot;Fix Connections&quot; button to resolve.
            </p>
          )}
        </div>
      ) : undefined}
    >
      <p>{summaryParts.join(", ")}</p>
    </InfoCard>
  );
}
