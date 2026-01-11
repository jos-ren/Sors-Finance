"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deletePortfolioItem, updatePortfolioItem, DbPortfolioItem, BucketType } from "@/lib/hooks/useDatabase";
import { usePrivacy } from "@/lib/privacy-context";
import { EditItemDialog } from "./EditItemDialog";
import { toast } from "sonner";
import { lookupTicker, getExchangeRate } from "@/lib/hooks/useStockPrice";
import { useHasFinnhubApiKey, useFinnhubApiKey } from "@/lib/settings-context";

interface PortfolioItemProps {
  item: DbPortfolioItem;
  bucket?: BucketType;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins === 1) return "1 min ago";
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

export function PortfolioItem({ item, bucket }: PortfolioItemProps) {
  const [showEdit, setShowEdit] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const apiKeyConfigured = useHasFinnhubApiKey();
  const apiKey = useFinnhubApiKey();
  const { formatAmount } = usePrivacy();

  const hasTicker = Boolean(item.ticker);

  const handleDelete = async () => {
    try {
      await deletePortfolioItem(item.id!);
      toast.success("Item deleted");
    } catch (error) {
      toast.error("Failed to delete item");
      console.error(error);
    }
  };

  const handleRefreshPrice = async () => {
    if (!item.ticker) return;

    if (!apiKeyConfigured) {
      toast.error("Finnhub API key not configured. Go to Settings to add your API key.");
      return;
    }

    setIsRefreshing(true);
    try {
      const quote = await lookupTicker(item.ticker, apiKey);
      if (quote) {
        // Use item's existing currency if user manually set it, otherwise use quote's currency
        const effectiveCurrency = (item.currency && item.currency.trim()) ? item.currency : quote.currency;

        // Get exchange rate based on the effective currency
        let exchangeRate = 1;
        if (effectiveCurrency !== "CAD") {
          exchangeRate = await getExchangeRate(effectiveCurrency, "CAD");
        }

        const newValue = (item.quantity || 0) * quote.price * exchangeRate;

        await updatePortfolioItem(item.id!, {
          pricePerUnit: quote.price,
          currency: effectiveCurrency,
          currentValue: newValue,
          lastPriceUpdate: new Date(),
        });

        toast.success("Price updated");
      } else {
        toast.error("Failed to fetch price. Check your API key in Settings.");
      }
    } catch (error) {
      toast.error("Failed to refresh price");
      console.error(error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between py-2 px-3 hover:bg-muted/50 rounded-md group">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{item.name}</p>
          {hasTicker ? (
            <p className="text-xs text-muted-foreground truncate">
              {item.ticker}
              {item.quantity !== undefined && ` · ${item.quantity} ${item.quantity === 1 ? "share" : "shares"}`}
              {item.pricePerUnit !== undefined && item.currency && ` @ ${formatPrice(item.pricePerUnit, item.currency)}`}
              {item.lastPriceUpdate && ` · ${getTimeAgo(new Date(item.lastPriceUpdate))}`}
            </p>
          ) : item.notes ? (
            <p className="text-sm text-muted-foreground truncate">{item.notes}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 ml-4">
          {hasTicker && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity ${
                !apiKeyConfigured ? "text-muted-foreground" : ""
              }`}
              onClick={handleRefreshPrice}
              disabled={isRefreshing}
              title={apiKeyConfigured ? "Refresh price" : "API key not configured - Go to Settings"}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          )}
          <span className="font-semibold tabular-nums">
            {formatAmount(item.currentValue, formatCurrency)}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowEdit(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <EditItemDialog
        item={item}
        open={showEdit}
        onOpenChange={setShowEdit}
        bucket={bucket}
      />
    </>
  );
}
