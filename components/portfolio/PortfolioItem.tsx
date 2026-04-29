"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2, RefreshCw, Circle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IconBadge } from "@/components/ui/icon-badge";
import { deletePortfolioItem, updatePortfolioItem, DbPortfolioItem, BucketType } from "@/lib/hooks/useDatabase";
import { usePrivacy } from "@/lib/privacy-context";
import { EditItemDialog } from "./EditItemDialog";
import { ItemHistoryDialog } from "./ItemHistoryDialog";
import { toast } from "sonner";
import { lookupTicker } from "@/lib/hooks/useStockPrice";
import { useHasFinnhubApiKey, useCurrency } from "@/lib/settings-context";
import { getTickerLogoUrl, getCryptoLogoUrl } from "@/lib/bank-logos";
import { getStockBg } from "@/lib/stock-logos";
import { getCryptoBg } from "@/lib/crypto-logos";

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

interface PortfolioItemProps {
  item: DbPortfolioItem;
  bucket?: BucketType;
}


export function PortfolioItem({ item, bucket }: PortfolioItemProps) {
  const [showEdit, setShowEdit] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tickerImgError, setTickerImgError] = useState(false);
  const userCurrency = useCurrency();
  const apiKeyConfigured = useHasFinnhubApiKey();
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

    // Only require API key for stocks (metals and crypto don't need it)
    if (item.type !== "metal" && item.type !== "crypto" && !apiKeyConfigured) {
      toast.error("Finnhub API key not configured. Go to Settings to add your API key.");
      return;
    }

    setIsRefreshing(true);
    try {
      let quote: { price: number; currency: string; name?: string } | null = null;

      // Fetch from the appropriate API based on tickerType
      if (item.type === "metal") {
        const response = await fetch(`/api/metals/${encodeURIComponent(item.ticker)}`);
        if (response.ok) {
          quote = await response.json();
        }
      } else if (item.type === "crypto") {
        const response = await fetch(`/api/crypto/${encodeURIComponent(item.ticker)}`);
        if (response.ok) {
          quote = await response.json();
        }
      } else {
        // Default to stock lookup
        quote = await lookupTicker(item.ticker);
      }

      if (quote) {
        // Use item's existing currency if user manually set it, otherwise use quote's currency
        const effectiveCurrency = (item.currency && item.currency.trim()) ? item.currency : quote.currency;

        // Get exchange rate
        let exchangeRate = 1;
        if (effectiveCurrency !== userCurrency) {
          const { getExchangeRate } = await import("@/lib/hooks/useStockPrice");
          exchangeRate = await getExchangeRate(effectiveCurrency, userCurrency);
        }

        const newValue = (item.quantity || 0) * quote.price * exchangeRate;

        await updatePortfolioItem(item.id!, {
          pricePerUnit: quote.price,
          currency: effectiveCurrency,
          currentValue: newValue,
          lastPriceUpdate: new Date(),
          source: "price_refresh",
        } as Record<string, unknown>);

        toast.success("Price updated");
      } else {
        toast.error("Failed to fetch price.");
      }
    } catch (error) {
      toast.error("Failed to refresh price");
      console.error(error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Determine icon for left column
  const renderIcon = () => {
    if (item.plaidAccountId) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <img
              src="/logos/plaid.png"
              alt="Plaid"
              className="h-full w-full object-contain p-2 cursor-help"
            />
          </TooltipTrigger>
          <TooltipContent>
            Balance synced via Plaid.
          </TooltipContent>
        </Tooltip>
      );
    }
    if (hasTicker) {
      const isMetal = item.type === "metal";
      const isCrypto = item.type === "crypto";
      const logoSrc = isCrypto
        ? getCryptoLogoUrl(item.ticker!)
        : !isMetal
        ? getTickerLogoUrl(item.ticker!)
        : null;

      const tooltipText = isCrypto
        ? "Price synced via CoinGecko"
        : isMetal
        ? "Price synced via Gold API"
        : "Price synced via Finnhub";

      const innerIcon =
        logoSrc && !tickerImgError ? (
          <img
            src={logoSrc}
            alt={item.ticker!}
            className="h-full w-full object-contain p-1.5 rounded-md"
            onError={() => setTickerImgError(true)}
          />
        ) : (
          <span className="text-[9px] font-bold leading-none select-none text-muted-foreground">
            {(item.ticker ?? item.name).slice(0, 3).toUpperCase()}
          </span>
        );

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center h-full w-full cursor-help overflow-hidden">
              {innerIcon}
            </div>
          </TooltipTrigger>
          <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>
      );
    }
    return <Circle className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 group">
        {/* Left icon column */}
        <div className="flex w-9 shrink-0 justify-center">
          <IconBadge
            size="sm"
            className={
              hasTicker && item.ticker
                ? (item.type === "crypto"
                    ? (getCryptoBg(item.ticker) ?? undefined)
                    : item.type !== "metal"
                    ? (getStockBg(item.ticker) ?? undefined)
                    : undefined)
                : undefined
            }
          >
            {renderIcon()}
          </IconBadge>
        </div>

        {/* Name + subtitle */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.name}</p>
          {hasTicker ? (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {item.ticker}
              {item.quantity !== undefined && ` · ${item.quantity} ${item.quantity === 1 ? "share" : "shares"}`}
              {item.pricePerUnit !== undefined && item.currency && ` @ ${formatAmount(item.pricePerUnit, item.currency)}`}
              {item.lastPriceUpdate && ` · ${getTimeAgo(new Date(item.lastPriceUpdate))}`}
            </p>
          ) : item.plaidAccountId && item.updatedAt ? (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              Synced {getTimeAgo(new Date(item.updatedAt))}
            </p>
          ) : item.notes ? (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{item.notes}</p>
          ) : null}
        </div>

        {/* Right: refresh + amount + dropdown */}
        <div className="flex items-center gap-1 shrink-0">
          {hasTicker && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity ${
                !apiKeyConfigured && item.type !== "metal" && item.type !== "crypto" ? "text-muted-foreground" : ""
              }`}
              onClick={handleRefreshPrice}
              disabled={isRefreshing}
              title={
                item.type === "metal" || item.type === "crypto" || apiKeyConfigured
                  ? "Refresh price"
                  : "API key not configured - Go to Settings"
              }
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          )}
          <span className="text-sm font-semibold tabular-nums mr-1">
            {formatAmount(item.currentValue, userCurrency)}
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
              <DropdownMenuItem onClick={() => setShowHistory(true)}>
                <History className="h-4 w-4 mr-2" />
                View History
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {showEdit && (
        <EditItemDialog
          item={item}
          open={showEdit}
          onOpenChange={setShowEdit}
          bucket={bucket}
        />
      )}
      {showHistory && (
        <ItemHistoryDialog
          item={item}
          bucket={bucket}
          open={showHistory}
          onOpenChange={setShowHistory}
        />
      )}
    </>
  );
}
