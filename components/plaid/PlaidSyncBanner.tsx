"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, X, ChevronDown, ChevronUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatCurrency } from "@/lib/formatters";
import { useCurrency } from "@/lib/settings-context";

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
  
  const hasErrors = accountsFailed > 0 || pricesFailed > 0;
  const hasLoginErrors = errors.some(err => 
    err.includes("login details") || 
    err.includes("credentials") || 
    err.includes("required user action")
  );

  const totalUpdated = accountsUpdated + pricesUpdated;
  const totalFailed = accountsFailed + pricesFailed;

  if (totalUpdated === 0 && totalFailed === 0) {
    return null;
  }

  return (
    <Alert
      variant={hasErrors ? "destructive" : "default"}
      className="relative"
    >
      <div className="flex items-start gap-3">
        {hasErrors ? (
          <AlertTriangle className="h-5 w-5 mt-0.5" />
        ) : (
          <CheckCircle2 className="h-5 w-5 mt-0.5" />
        )}
        
        <div className="flex-1 space-y-2">
          <AlertTitle className="flex items-center gap-2">
            {hasErrors ? "Sync Partially Complete" : "Sync Complete"}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 -ml-1"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5 mr-1" />
                  <span className="text-xs">Hide Details</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5 mr-1" />
                  <span className="text-xs">Show Details</span>
                </>
              )}
            </Button>
          </AlertTitle>
          
          <AlertDescription className="space-y-2">
            {/* Summary */}
            <p>
              {accountsUpdated > 0 && (
                <span className="font-medium">
                  {accountsUpdated} account{accountsUpdated === 1 ? "" : "s"} synced
                </span>
              )}
              {accountsUpdated > 0 && pricesUpdated > 0 && ", "}
              {pricesUpdated > 0 && (
                <span className="font-medium">
                  {pricesUpdated} price{pricesUpdated === 1 ? "" : "s"} updated
                </span>
              )}
              {(accountsUpdated > 0 || pricesUpdated > 0) && (accountsFailed > 0 || pricesFailed > 0) && ", "}
              {accountsFailed > 0 && (
                <span className="font-medium text-destructive">
                  {accountsFailed} account{accountsFailed === 1 ? "" : "s"} failed
                </span>
              )}
              {accountsFailed > 0 && pricesFailed > 0 && ", "}
              {pricesFailed > 0 && (
                <span className="font-medium text-destructive">
                  {pricesFailed} price{pricesFailed === 1 ? "" : "s"} failed
                </span>
              )}
            </p>

            {/* Expandable Details */}
            {expanded && (
              <div className="mt-3 space-y-3 border-t pt-3">
                {/* Synced Accounts */}
                {syncedAccounts.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">✓ Accounts Synced</div>
                    <div className="space-y-1.5 pl-4">
                      {syncedAccounts.map((account, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{account.name}</span>
                          <span className="font-mono tabular-nums">{formatCurrency(account.balance, userCurrency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Synced Prices */}
                {syncedPrices.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">✓ Prices Updated</div>
                    <div className="space-y-1.5 pl-4">
                      {syncedPrices.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {item.ticker} - {item.itemName}
                          </span>
                          <span className="font-mono tabular-nums">{formatCurrency(item.price, item.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Account Errors */}
                {errors.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-destructive mb-2">✗ Account Errors</div>
                    <ul className="space-y-1 pl-4 list-disc list-inside">
                      {errors.map((error, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Price Errors */}
                {priceErrors.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-destructive mb-2">✗ Price Errors</div>
                    <ul className="space-y-1 pl-4 list-disc list-inside">
                      {priceErrors.map((item, idx) => (
                        <li key={idx} className="text-xs">
                          <span className="text-muted-foreground">
                            {item.ticker} - {item.itemName}:
                          </span>{" "}
                          <span className="text-destructive">{item.error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Login Errors Link */}
            {hasLoginErrors && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm">
                  Some banks require re-authentication.
                </span>
                <Link href="/settings?tab=integrations">
                  <Button variant="outline" size="sm" className="h-7 gap-1">
                    Go to Integrations
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            )}
          </AlertDescription>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
