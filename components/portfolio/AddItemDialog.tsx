"use client";

import { useState, useCallback } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addPortfolioItem, BucketType, PriceMode } from "@/lib/hooks/useDatabase";
import { lookupTicker, getExchangeRate } from "@/lib/hooks/useStockPrice";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number;
  accountName: string;
  bucket?: BucketType;
}

export function AddItemDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  bucket,
}: AddItemDialogProps) {
  const isInvestment = bucket === "Investments";

  // Basic fields
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Price mode toggle (ticker = auto-fetch, manual = user-entered)
  const [priceMode, setPriceMode] = useState<PriceMode>("ticker");

  // Investment-specific fields
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [currency, setCurrency] = useState("CAD");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [tickerError, setTickerError] = useState<string | null>(null);

  // For non-investment items, just use a simple value
  const [value, setValue] = useState("");

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

  // Lookup ticker
  const handleTickerLookup = async () => {
    if (!ticker.trim()) {
      setTickerError(null);
      return;
    }

    setIsLookingUp(true);
    setTickerError(null);

    try {
      const quote = await lookupTicker(ticker.trim());

      if (quote) {
        // Auto-fill fields from quote
        setName(quote.name);
        setPricePerUnit(quote.price.toString());
        setCurrency(quote.currency);

        // Fetch exchange rate if not CAD
        if (quote.currency !== "CAD") {
          const rate = await getExchangeRate(quote.currency, "CAD");
          setExchangeRate(rate);
        } else {
          setExchangeRate(1);
        }

        setTicker(quote.ticker); // Use normalized ticker
      } else {
        setTickerError("Ticker not found");
      }
    } catch {
      setTickerError("Failed to lookup ticker");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleTickerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTickerLookup();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);

    try {
      if (isInvestment) {
        await addPortfolioItem({
          accountId,
          name: name.trim(),
          currentValue: totalCAD,
          notes: notes.trim() || undefined,
          ticker: priceMode === "ticker" ? ticker.toUpperCase() : undefined,
          quantity: parseFloat(quantity) || 0,
          pricePerUnit: parseFloat(pricePerUnit) || 0,
          currency,
          lastPriceUpdate: priceMode === "ticker" ? new Date() : undefined,
          priceMode,
        });
      } else {
        await addPortfolioItem({
          accountId,
          name: name.trim(),
          currentValue: parseFloat(value) || 0,
          notes: notes.trim() || undefined,
          priceMode: "manual",
        });
      }

      toast.success("Item added successfully");
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to add item");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setValue("");
    setNotes("");
    setTicker("");
    setQuantity("");
    setPricePerUnit("");
    setCurrency("CAD");
    setExchangeRate(1);
    setTickerError(null);
    setPriceMode("ticker");
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isInvestment ? "Add Investment" : "Add Item"}
          </DialogTitle>
          <DialogDescription>
            Add a new item to {accountName}.
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
                    ? "Price updates automatically from Yahoo Finance"
                    : "You enter and update the price manually"}
                </p>
              </div>
            )}

            {/* Ticker field for investments in ticker mode */}
            {isInvestment && priceMode === "ticker" && (
              <div className="grid gap-2">
                <Label htmlFor="ticker">Ticker</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="ticker"
                      value={ticker}
                      onChange={(e) => setTicker(e.target.value.toUpperCase())}
                      onBlur={handleTickerLookup}
                      onKeyDown={handleTickerKeyDown}
                      placeholder="e.g., AAPL, BTC-USD"
                      className={tickerError ? "border-destructive" : ""}
                    />
                    {isLookingUp && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleTickerLookup}
                    disabled={isLookingUp || !ticker.trim()}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                {tickerError && (
                  <p className="text-xs text-destructive">{tickerError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Uses{" "}
                  <a
                    href="https://finance.yahoo.com/lookup/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Yahoo Finance
                  </a>
                  {" "}tickers (e.g., AAPL, GOOGL, BTC-USD)
                </p>
              </div>
            )}

            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  isInvestment
                    ? "e.g., Apple Inc., Bitcoin"
                    : "e.g., TD Chequing, Visa Infinite"
                }
                autoFocus={!isInvestment}
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
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={pricePerUnit}
                      onChange={(e) => setPricePerUnit(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Currency</Label>
                    <div className="flex gap-2">
                      <Input
                        id="currency"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value.toUpperCase())}
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
              <div className="grid gap-2">
                <Label htmlFor="value">Current Value ($)</Label>
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}

            {/* Notes */}
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
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? "Adding..." : isInvestment ? "Add Investment" : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
