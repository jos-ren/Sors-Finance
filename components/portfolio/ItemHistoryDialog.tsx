"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getPortfolioItemHistory } from "@/lib/db/client/portfolio";
import type { DbPortfolioItem, DbPortfolioItemHistory, BucketType } from "@/lib/db/types";
import { useCurrency } from "@/lib/settings-context";
import { usePrivacy } from "@/lib/privacy-context";

interface ItemHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DbPortfolioItem;
  bucket?: BucketType;
}

const SOURCE_LABELS: Record<string, { label: string; className: string }> = {
  manual: { label: "Manual", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  buy: { label: "Buy", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  sell: { label: "Sell", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  deposit: { label: "Deposit", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  withdrawal: { label: "Withdrawal", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  payment: { label: "Payment", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  appreciation: { label: "Appreciation", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  depreciation: { label: "Depreciation", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  plaid_sync: { label: "Plaid Sync", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  price_refresh: { label: "Price Refresh", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  created: { label: "Added", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  deleted: { label: "Deleted", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

function getSourceKey(entry: DbPortfolioItemHistory, bucket?: string): string {
  if (entry.source !== "manual") return entry.source;

  const qtyChange = entry.changes.find((c) => c.field === "quantity");
  const valueChange = entry.changes.find((c) => c.field === "currentValue");

  if (bucket === "Investments" && qtyChange) {
    const diff = (Number(qtyChange.newValue) || 0) - (Number(qtyChange.oldValue) || 0);
    if (diff > 0) return "buy";
    if (diff < 0) return "sell";
  }
  if (bucket === "Savings" && valueChange) {
    const diff = (Number(valueChange.newValue) || 0) - (Number(valueChange.oldValue) || 0);
    if (diff > 0) return "deposit";
    if (diff < 0) return "withdrawal";
  }
  if (bucket === "Debt" && valueChange) {
    const diff = (Number(valueChange.newValue) || 0) - (Number(valueChange.oldValue) || 0);
    if (diff < 0) return "payment";
    if (diff > 0) return "withdrawal";
  }
  if (bucket === "Assets" && valueChange) {
    const diff = (Number(valueChange.newValue) || 0) - (Number(valueChange.oldValue) || 0);
    if (diff > 0) return "appreciation";
    if (diff < 0) return "depreciation";
  }

  return "manual";
}

function formatChange(
  field: string,
  oldValue: string | number | null,
  newValue: string | number | null,
  formatAmount: (v: number, c: string) => string,
  currency: string
): string {
  if (field === "name") {
    if (oldValue === null) return `"${newValue}"`;
    if (newValue === null) return `"${oldValue}"`;
    return `Renamed "${oldValue}" → "${newValue}"`;
  }
  if (field === "quantity") {
    if (oldValue === null) return `Quantity: ${newValue}`;
    if (newValue === null) return `Quantity: ${oldValue}`;
    const diff = (Number(newValue) || 0) - (Number(oldValue) || 0);
    const sign = diff > 0 ? "+" : "";
    return `Quantity: ${sign}${diff} (${oldValue} → ${newValue})`;
  }
  if (field === "currentValue" || field === "pricePerUnit") {
    const label = field === "currentValue" ? "Value" : "Price/Unit";
    if (oldValue === null) return `${label}: ${formatAmount(Number(newValue) || 0, currency)}`;
    if (newValue === null) return `${label}: ${formatAmount(Number(oldValue) || 0, currency)}`;
    return `${label}: ${formatAmount(Number(oldValue) || 0, currency)} → ${formatAmount(Number(newValue) || 0, currency)}`;
  }
  return `${field}: ${oldValue} → ${newValue}`;
}

function changeColor(field: string, oldValue: string | number | null, newValue: string | number | null): string {
  if (field === "name") return "";
  if (newValue === null) return "text-red-600 dark:text-red-400";
  if (oldValue === null) return "text-emerald-600 dark:text-emerald-400";
  const diff = (Number(newValue) || 0) - (Number(oldValue) || 0);
  if (diff > 0) return "text-emerald-600 dark:text-emerald-400";
  if (diff < 0) return "text-red-600 dark:text-red-400";
  return "";
}

export function ItemHistoryDialog({ open, onOpenChange, item, bucket }: ItemHistoryDialogProps) {
  const [history, setHistory] = useState<DbPortfolioItemHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const userCurrency = useCurrency();
  const { formatAmount } = usePrivacy();

  useEffect(() => {
    if (!open || !item.id) return;
    setIsLoading(true);
    getPortfolioItemHistory(item.id)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [open, item.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>History — {item.name}</DialogTitle>
          <DialogDescription>Change history for this item, newest first.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No history yet</p>
              <p className="text-xs mt-1">Changes will appear here after edits, syncs, or price refreshes.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {history.map((entry) => {
                const source = SOURCE_LABELS[getSourceKey(entry, bucket)] || SOURCE_LABELS.manual;
                const date = new Date(entry.createdAt);
                return (
                  <div key={entry.id} className="flex flex-col gap-1 py-2.5 border-b last:border-b-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        {" "}
                        {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <Badge variant="outline" className={source.className}>
                        {source.label}
                      </Badge>
                    </div>
                    <div className="space-y-0.5">
                      {entry.changes.map((change, i) => (
                        <p
                          key={i}
                          className={`text-sm ${changeColor(change.field, change.oldValue, change.newValue)}`}
                        >
                          {formatChange(change.field, change.oldValue, change.newValue, formatAmount, userCurrency)}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
