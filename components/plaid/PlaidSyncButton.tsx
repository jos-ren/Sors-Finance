"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { invalidatePortfolio } from "@/lib/hooks/useDatabase";

interface PlaidSyncButtonProps {
  variant?: "default" | "secondary" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
  className?: string;
  itemId?: number;
  bankName?: string;
  onSyncComplete?: (result: {
    accountsUpdated: number;
    accountsFailed: number;
    pricesUpdated: number;
    pricesFailed: number;
    errors: string[];
    priceErrors: Array<{
      ticker: string;
      itemName: string;
      error: string;
    }>;
    syncedAccounts: Array<{
      accountId: string;
      name: string;
      balance: number;
    }>;
    syncedPrices: Array<{
      ticker: string;
      itemName: string;
      price: number;
      currency: string;
    }>;
  }) => void;
}

export function PlaidSyncButton({
  variant = "secondary",
  size = "sm",
  className,
  itemId,
  bankName,
  onSyncComplete
}: PlaidSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/plaid/balances", {
        method: "POST",
        headers: itemId ? { "Content-Type": "application/json" } : undefined,
        body: itemId ? JSON.stringify({ itemId }) : undefined,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to sync balances");
      }

      const data = await response.json();

      // Show success with details
      const accountsUpdated = data.accountsUpdated || 0;
      const accountsFailed = data.accountsFailed || 0;
      const pricesUpdated = data.pricesUpdated || 0;
      const pricesFailed = data.pricesFailed || 0;
      const syncedAccounts = data.syncedAccounts || [];
      const syncedPrices = data.syncedPrices || [];
      const errors = data.errors || [];
      const priceErrors = data.priceErrors || [];

      // Invalidate portfolio cache to refresh UI with new balances and prices
      if (accountsUpdated > 0 || pricesUpdated > 0) {
        invalidatePortfolio();
      }

      // Pass results to parent component if callback provided
      if (onSyncComplete) {
        onSyncComplete({
          accountsUpdated,
          accountsFailed,
          pricesUpdated,
          pricesFailed,
          errors,
          priceErrors,
          syncedAccounts,
          syncedPrices,
        });
      }

      // Build comprehensive success/error message
      const totalUpdated = accountsUpdated + pricesUpdated;
      const totalFailed = accountsFailed + pricesFailed;

      if (totalUpdated > 0 && totalFailed === 0) {
        const parts: string[] = [];
        if (accountsUpdated > 0) parts.push(`${accountsUpdated} account${accountsUpdated === 1 ? '' : 's'}`);
        if (pricesUpdated > 0) parts.push(`${pricesUpdated} price${pricesUpdated === 1 ? '' : 's'}`);
        const prefix = bankName ? `${bankName} — ` : '';
        toast.success(`${prefix}Synced ${parts.join(' and ')} successfully`);
      } else if (totalUpdated > 0 && totalFailed > 0) {
        const successParts: string[] = [];
        if (accountsUpdated > 0) successParts.push(`${accountsUpdated} account${accountsUpdated === 1 ? '' : 's'}`);
        if (pricesUpdated > 0) successParts.push(`${pricesUpdated} price${pricesUpdated === 1 ? '' : 's'}`);
        const failParts: string[] = [];
        if (accountsFailed > 0) failParts.push(`${accountsFailed} account${accountsFailed === 1 ? '' : 's'}`);
        if (pricesFailed > 0) failParts.push(`${pricesFailed} price${pricesFailed === 1 ? '' : 's'}`);
        const prefix = bankName ? `${bankName} — ` : '';
        toast.warning(`${prefix}Synced ${successParts.join(' and ')}, but ${failParts.join(' and ')} failed`);
      } else if (totalFailed > 0) {
        const failParts: string[] = [];
        if (accountsFailed > 0) failParts.push(`${accountsFailed} account${accountsFailed === 1 ? '' : 's'}`);
        if (pricesFailed > 0) failParts.push(`${pricesFailed} price${pricesFailed === 1 ? '' : 's'}`);
        const prefix = bankName ? `${bankName} — ` : '';
        toast.error(`${prefix}Failed to sync ${failParts.join(' and ')}`);
      } else {
        toast.info(bankName ? `${bankName} — Nothing to sync` : "Nothing to sync");
      }

      // After successful sync, create/update today's snapshot
      if (totalUpdated > 0) {
        try {
          const snapshotResponse = await fetch("/api/portfolio/snapshots/today", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ skipSync: true }), // Sync already happened
          });

          if (snapshotResponse.ok) {
            console.log("Snapshot created/updated after sync");
          } else {
            console.error("Failed to create snapshot after sync");
          }
        } catch (snapshotError) {
          console.error("Error creating snapshot after sync:", snapshotError);
          // Don't show error to user - snapshot is secondary to sync
        }
      }
    } catch (error) {
      console.error("Error syncing balances:", error);
      toast.error(error instanceof Error ? error.message : "Failed to sync balances");
    } finally {
      setIsSyncing(false);
    }
  };

  const isIconOnly = size?.startsWith("icon");

  const button = (
    <Button
      variant={variant}
      size={size as "default" | "sm" | "lg" | "icon"}
      onClick={handleSync}
      disabled={isSyncing}
      className={className}
    >
      <RefreshCw className={`h-4 w-4 ${isIconOnly ? "" : "mr-2 "}${isSyncing ? "animate-spin" : ""}`} />
      {!isIconOnly && "Sync All"}
    </Button>
  );

  if (isIconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom">Sync All</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
