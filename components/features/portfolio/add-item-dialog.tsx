"use client";

import { useState, useCallback, useEffect } from "react";
import { RefreshCw, Info, TrendingUp, Wallet } from "lucide-react";
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
import { addPortfolioItem, BucketType } from '@/hooks/use-database';
import { getExchangeRate } from '@/hooks/use-stock-price';
import { useHasFinnhubApiKey, useSettings } from "@/contexts/settings-context";
import { toast } from "sonner";
import { InfoCard } from "@/components/ui/info-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TickerSearch, SelectedTicker } from "./ticker-search";
import { usePrivacy } from "@/contexts/privacy-context";

type InvestmentType = "security" | "balance";

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
  const hasApiKey = useHasFinnhubApiKey();
  const { isLoading, settings } = useSettings();
  const userCurrency = settings.currency;
  const { formatAmount } = usePrivacy();

  // Show warning if no API key is configured (only after settings loaded)
  const showApiKeyWarning = !isLoading && !hasApiKey;

  // Debug logging
  useEffect(() => {
    if (open && isInvestment) {
      console.log("AddItemDialog - API Key Check:", {
        hasApiKey,
        isLoading,
        showApiKeyWarning
      });
    }
  }, [open, isInvestment, hasApiKey, isLoading, showApiKeyWarning]);

  // Basic fields
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Investment type selection (security = ticker-based, balance = manual)
  const [investmentType, setInvestmentType] = useState<InvestmentType | null>(null);

  // Selected ticker from search
  const [selectedTicker, setSelectedTicker] = useState<SelectedTicker | null>(null);

  // Investment-specific fields
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [currency, setCurrency] = useState<string>(userCurrency);
  const [exchangeRate, setExchangeRate] = useState(1);

  // For non-investment items, just use a simple value
  const [value, setValue] = useState("");

  // When ticker is selected, populate fields
  useEffect(() => {
    if (selectedTicker) {
      setName(selectedTicker.name);
      setPricePerUnit(selectedTicker.price.toFixed(2));
      setCurrency(selectedTicker.currency);

      // Fetch exchange rate if not user's currency
      if (selectedTicker.currency !== userCurrency) {
        getExchangeRate(selectedTicker.currency, userCurrency).then(setExchangeRate);
      } else {
        setExchangeRate(1);
      }
    }
  }, [selectedTicker, userCurrency]);

  // Calculate total value in user's currency
  const calculateTotal = useCallback(() => {
    if (isInvestment) {
      const qty = parseFloat(quantity) || 0;
      const price = parseFloat(pricePerUnit) || 0;
      return qty * price * exchangeRate;
    }
    return parseFloat(value) || 0;
  }, [isInvestment, quantity, pricePerUnit, exchangeRate, value]);

  const totalValue = calculateTotal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);

    try {
      if (isInvestment && investmentType === "security") {
        // Security type - ticker-based with quantity and price
        await addPortfolioItem({
          accountId,
          name: name.trim(),
          currentValue: totalValue,
          notes: notes.trim() || undefined,
          ticker: selectedTicker ? selectedTicker.symbol : undefined,
          quantity: parseFloat(quantity) || 0,
          pricePerUnit: parseFloat(pricePerUnit) || 0,
          currency,
          lastPriceUpdate: selectedTicker ? new Date() : undefined,
          priceMode: "ticker",
          tickerType: selectedTicker ? selectedTicker.tickerType : undefined,
          type: selectedTicker ? selectedTicker.tickerType : "other",
          isInternational: selectedTicker ? selectedTicker.isInternational : undefined,
        });
      } else if (isInvestment && investmentType === "balance") {
        // Balance type - simple manual value
        await addPortfolioItem({
          accountId,
          name: name.trim(),
          currentValue: parseFloat(value) || 0,
          notes: notes.trim() || undefined,
          priceMode: "manual",
        });
      } else {
        // Non-investment items
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
    setSelectedTicker(null);
    setQuantity("");
    setPricePerUnit("");
    setCurrency(userCurrency);
    setExchangeRate(1);
    setInvestmentType(null);
  };

  // Handle ticker selection from search
  const handleTickerSelect = (ticker: SelectedTicker | null) => {
    setSelectedTicker(ticker);
    if (!ticker) {
      // Clear fields when ticker is deselected
      setName("");
      setPricePerUnit("");
      setCurrency(userCurrency);
      setExchangeRate(1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
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
            {/* Show loading while settings are being fetched */}
            {isInvestment && isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">Loading settings...</div>
              </div>
            )}

            {/* Investment type selection */}
            {isInvestment && !isLoading && !investmentType && (
              <div className="grid gap-3">
                {showApiKeyWarning && (
                  <InfoCard variant="warning">
                    <strong>API key required for live prices.</strong> Add a Finnhub API key to track stocks, crypto, and metals.{" "}
                    <Link href="/settings" className="underline font-medium">
                      Add in Settings
                    </Link>
                  </InfoCard>
                )}
                <Label>What type of investment?</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => !showApiKeyWarning && setInvestmentType("security")}
                    disabled={showApiKeyWarning}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                      showApiKeyWarning
                        ? "border-muted bg-muted/30 cursor-not-allowed opacity-50"
                        : "border-muted hover:border-primary hover:bg-muted/50"
                    }`}
                  >
                    <TrendingUp className="h-8 w-8 text-muted-foreground" />
                    <span className="font-medium">Security</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Stocks, ETFs, crypto, commodities
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvestmentType("balance")}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-muted hover:border-primary hover:bg-muted/50 transition-colors"
                  >
                    <Wallet className="h-8 w-8 text-muted-foreground" />
                    <span className="font-medium">Balance</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Manually tracked account balance
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Ticker search for security type */}
            {isInvestment && investmentType === "security" && (
              <div className="grid gap-2">
                <Label>Search Ticker</Label>
                <TickerSearch
                  value={selectedTicker}
                  onSelect={handleTickerSelect}
                />
              </div>
            )}

            {/* Name - show for balance type, non-investments, or when ticker is selected */}
            {(!isInvestment || investmentType === "balance" || selectedTicker) && (
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    isInvestment
                      ? investmentType === "balance"
                        ? "e.g., RRSP, TFSA, Brokerage Cash"
                        : "e.g., Apple Inc., Bitcoin"
                      : "e.g., TD Chequing, Visa Infinite"
                  }
                  autoFocus={!isInvestment || investmentType === "balance"}
                  disabled={isInvestment && investmentType === "security" && !!selectedTicker}
                />
              </div>
            )}

            {/* Security-specific fields (quantity, price, currency) */}
            {isInvestment && investmentType === "security" && selectedTicker && (
              <>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="price">Price per Unit</Label>
                    <CurrencyInput
                      id="price"
                      value={pricePerUnit}
                      onChange={setPricePerUnit}
                      placeholder="0.00"
                      disabled={!!selectedTicker}
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
                          if (currency && currency !== userCurrency) {
                            const rate = await getExchangeRate(currency, userCurrency);
                            setExchangeRate(rate);
                          } else {
                            setExchangeRate(1);
                          }
                        }}
                        placeholder="USD"
                        className="flex-1"
                      />
                      {currency !== userCurrency && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            const rate = await getExchangeRate(currency, userCurrency);
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

                {currency !== userCurrency && exchangeRate !== 1 && (
                  <p className="text-xs text-muted-foreground">
                    Exchange rate: 1 {currency} = {exchangeRate.toFixed(4)} {userCurrency}
                  </p>
                )}

                <div className="rounded-lg bg-muted p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Value ({userCurrency})</span>
                    <span className="text-lg font-semibold">{formatAmount(totalValue, userCurrency)}</span>
                  </div>
                </div>
              </>
            )}

            {/* Balance type - simple value entry */}
            {isInvestment && investmentType === "balance" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="value">Current Balance ($)</Label>
                  <CurrencyInput
                    id="value"
                    value={value}
                    onChange={setValue}
                    placeholder="0.00"
                  />
                </div>
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

            {/* Non-investment items */}
            {!isInvestment && (
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
            {isInvestment && investmentType && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setInvestmentType(null);
                  setSelectedTicker(null);
                  setName("");
                  setValue("");
                  setQuantity("");
                  setPricePerUnit("");
                }}
                className="mr-auto"
              >
                Back
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !name.trim() ||
                (isInvestment && !investmentType)
              }
            >
              {isSubmitting
                ? "Adding..."
                : isInvestment
                  ? investmentType === "security"
                    ? "Add Security"
                    : "Add Balance"
                  : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
