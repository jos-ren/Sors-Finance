"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertTriangle, Info } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updatePortfolioItem, DbPortfolioItem, BucketType, PriceMode } from "@/lib/hooks/useDatabase";
import { getExchangeRate } from "@/lib/hooks/useStockPrice";
import { useSettings } from "@/lib/settings-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TickerSearch, SelectedTicker } from "./TickerSearch";

interface EditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DbPortfolioItem;
  bucket?: BucketType;
}

export function EditItemDialog({ open, onOpenChange, item, bucket }: EditItemDialogProps) {
  const isInvestment = bucket === "Investments";
  const { hasFinnhubApiKey, isLoading: settingsLoading } = useSettings();
  // Only show warning after settings have loaded and there's no key
  const showApiKeyWarning = !settingsLoading && !hasFinnhubApiKey;

  // Basic fields
  const [name, setName] = useState(item.name);
  const [notes, setNotes] = useState(item.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Price mode toggle (ticker = auto-fetch, manual = user-entered)
  const [priceMode, setPriceMode] = useState<PriceMode>(item.priceMode || "ticker");

  // Selected ticker from search
  const [selectedTicker, setSelectedTicker] = useState<SelectedTicker | null>(
    item.ticker ? {
      symbol: item.ticker,
      name: item.name,
      price: item.pricePerUnit || 0,
      currency: item.currency || "USD",
    } : null
  );

  // Investment-specific fields
  const [quantity, setQuantity] = useState(item.quantity?.toString() || "");
  const [pricePerUnit, setPricePerUnit] = useState(item.pricePerUnit != null ? item.pricePerUnit.toFixed(2) : "");
  const [currency, setCurrency] = useState(item.currency || "CAD");
  const [exchangeRate, setExchangeRate] = useState(1);

  // For non-investment items
  const [value, setValue] = useState(item.currentValue.toString());

  // Reset form when item changes
  useEffect(() => {
    setName(item.name);
    setNotes(item.notes || "");
    setPriceMode(item.priceMode || "ticker");
    setSelectedTicker(
      item.ticker ? {
        symbol: item.ticker,
        name: item.name,
        price: item.pricePerUnit || 0,
        currency: item.currency || "USD",
      } : null
    );
    setQuantity(item.quantity?.toString() || "");
    setPricePerUnit(item.pricePerUnit != null ? item.pricePerUnit.toFixed(2) : "");
    setCurrency(item.currency || "CAD");
    setValue(item.currentValue.toString());

    // Fetch exchange rate if currency is not CAD
    if (item.currency && item.currency !== "CAD") {
      getExchangeRate(item.currency, "CAD").then(setExchangeRate);
    } else {
      setExchangeRate(1);
    }
  }, [item]);

  // When ticker is selected, populate fields
  useEffect(() => {
    if (selectedTicker) {
      setName(selectedTicker.name);
      setPricePerUnit(selectedTicker.price.toFixed(2));
      setCurrency(selectedTicker.currency);

      // Fetch exchange rate if not CAD
      if (selectedTicker.currency !== "CAD") {
        getExchangeRate(selectedTicker.currency, "CAD").then(setExchangeRate);
      } else {
        setExchangeRate(1);
      }
    }
  }, [selectedTicker]);

  // Calculate total value in CAD
  const calculateTotalCAD = useCallback(() => {
    if (isInvestment) {
      const qty = parseFloat(quantity) || 0;
      const price = parseFloat(pricePerUnit) || 0;
      return qty * price * exchangeRate;
    }
    return parseFloat(value) || 0;
  }, [isInvestment, quantity, pricePerUnit, exchangeRate, value]);

  const totalCAD = calculateTotalCAD();

  // Handle ticker selection from search
  const handleTickerSelect = (ticker: SelectedTicker | null) => {
    setSelectedTicker(ticker);
    if (!ticker) {
      // Clear fields when ticker is deselected
      setName("");
      setPricePerUnit("");
      setCurrency("CAD");
      setExchangeRate(1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);

    try {
      if (isInvestment) {
        await updatePortfolioItem(item.id!, {
          name: name.trim(),
          currentValue: totalCAD,
          notes: notes.trim() || undefined,
          ticker: priceMode === "ticker" && selectedTicker ? selectedTicker.symbol : undefined,
          quantity: parseFloat(quantity) || 0,
          pricePerUnit: parseFloat(pricePerUnit) || 0,
          currency,
          lastPriceUpdate: priceMode === "ticker" && selectedTicker ? new Date() : undefined,
          priceMode,
        });
      } else {
        await updatePortfolioItem(item.id!, {
          name: name.trim(),
          currentValue: parseFloat(value) || 0,
          notes: notes.trim() || undefined,
          ticker: undefined,
          quantity: undefined,
          pricePerUnit: undefined,
          currency: undefined,
          lastPriceUpdate: undefined,
          priceMode: "manual",
        });
      }

      toast.success("Item updated successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update item");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isInvestment ? "Edit Investment" : "Edit Item"}
          </DialogTitle>
          <DialogDescription>
            Update the details for this item.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Price mode toggle for investments */}
            {isInvestment && (
              <div className="grid gap-2">
                <Label>Price Mode</Label>
                <div className="flex rounded-lg border p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setPriceMode("ticker")}
                    className={cn(
                      "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                      priceMode === "ticker"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    Ticker (Auto)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceMode("manual")}
                    className={cn(
                      "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                      priceMode === "manual"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    Manual
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {priceMode === "ticker"
                    ? "Price updates automatically via Finnhub (requires API key)"
                    : "You enter and update the price manually"}
                </p>
                {priceMode === "ticker" && showApiKeyWarning && (
                  <Alert className="mt-2 border-yellow-500/50 bg-yellow-500/10">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription className="text-xs">
                      <strong>API key required.</strong> Ticker lookup won&apos;t work without a Finnhub API key.{" "}
                      <Link href="/settings" className="underline font-medium">
                        Add API key in Settings
                      </Link>{" "}
                      or switch to Manual mode.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Ticker search for investments in ticker mode */}
            {isInvestment && priceMode === "ticker" && (
              <div className="grid gap-2">
                <Label>Search Ticker</Label>
                <TickerSearch
                  value={selectedTicker}
                  onSelect={handleTickerSelect}
                  hasApiKey={hasFinnhubApiKey}
                />
              </div>
            )}

            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Apple Inc., Bitcoin"
                autoFocus={!isInvestment || priceMode === "manual"}
                disabled={isInvestment && priceMode === "ticker" && !!selectedTicker}
              />
            </div>

            {/* Investment-specific fields */}
            {isInvestment ? (
              <>
                {/* Quantity */}
                <div className="grid gap-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="any"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Number of shares/units"
                  />
                </div>

                {/* Price per unit */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="price">Price per Unit</Label>
                    <CurrencyInput
                      id="price"
                      value={pricePerUnit}
                      onChange={setPricePerUnit}
                      placeholder="0.00"
                      disabled={priceMode === "ticker" && !!selectedTicker}
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="currency">Currency</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px]">
                            <p className="text-xs">
                              The currency the stock trades in. You can change this if the auto-detected value is incorrect.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="currency"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                        onBlur={async () => {
                          // Fetch exchange rate when user is done typing
                          if (currency && currency !== "CAD") {
                            const rate = await getExchangeRate(currency, "CAD");
                            setExchangeRate(rate);
                          } else {
                            setExchangeRate(1);
                          }
                        }}
                        placeholder="USD"
                        className="flex-1"
                      />
                      {currency !== "CAD" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            const rate = await getExchangeRate(currency, "CAD");
                            setExchangeRate(rate);
                          }}
                          title="Refresh exchange rate"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Exchange rate info */}
                {currency !== "CAD" && exchangeRate !== 1 && (
                  <p className="text-xs text-muted-foreground">
                    Exchange rate: 1 {currency} = {exchangeRate.toFixed(4)} CAD
                  </p>
                )}

                {/* Total value */}
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Value (CAD)</span>
                    <span className="text-lg font-semibold">{formatCurrency(totalCAD)}</span>
                  </div>
                </div>
              </>
            ) : (
              /* Non-investment: simple value field */
              <>
                <div className="grid gap-2">
                  <Label htmlFor="value">Current Value ($)</Label>
                  <CurrencyInput
                    id="value"
                    value={value}
                    onChange={setValue}
                    placeholder="0.00"
                    allowNegative={bucket === "Debt"}
                  />
                </div>

                {/* Notes - only for non-investments */}
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes..."
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
