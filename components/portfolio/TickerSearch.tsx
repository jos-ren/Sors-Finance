"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useHasFinnhubApiKey } from "@/lib/settings-context";
import { InfoCard } from "@/components/ui/info-card";

export interface TickerResult {
  symbol: string;
  displaySymbol: string;
  name: string;
  type: string;
}

export interface SelectedTicker {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  isInternational?: boolean;
  tickerType: "stock" | "crypto" | "metal";
}

type SearchMode = "stocks" | "crypto" | "metals";

interface TickerSearchProps {
  value?: SelectedTicker | null;
  onSelect: (ticker: SelectedTicker | null) => void;
  disabled?: boolean;
}

export function TickerSearch({ value, onSelect, disabled }: TickerSearchProps) {
  const hasApiKey = useHasFinnhubApiKey();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<TickerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>("stocks");

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Search for symbols with debounce
  const searchSymbols = useCallback(async (query: string, mode: SearchMode) => {
    // Only stocks require API key - crypto and metals work without it
    if (!hasApiKey && mode === "stocks") {
      setError("API key required for stock search");
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      let endpoint: string;
      if (mode === "crypto") {
        endpoint = `/api/crypto/search?q=${encodeURIComponent(query)}`;
      } else if (mode === "metals") {
        endpoint = `/api/metals/search?q=${encodeURIComponent(query)}`;
      } else {
        endpoint = `/api/stock/search?q=${encodeURIComponent(query)}`;
      }

      const response = await fetch(endpoint);

      if (!response.ok) {
        const data = await response.json();
        if (data.code === 'RATE_LIMIT') {
          setError("Rate limit - try again shortly");
        } else if (data.code === 'NO_API_KEY') {
          setError("API key not configured");
        } else {
          setError("Search failed");
        }
        return;
      }

      const data = await response.json();
      setResults(data.results || []);
      setHighlightedIndex(0);
    } catch {
      setError("Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [hasApiKey]);

  // Debounced search effect
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Only search if popover is open
    if (!open) {
      return;
    }

    // For crypto and metals, show results even without search query
    if ((searchMode === "crypto" || searchMode === "metals") && !search.trim()) {
      debounceRef.current = setTimeout(() => {
        searchSymbols("", searchMode);
      }, 100);
    } else if (search.trim()) {
      debounceRef.current = setTimeout(() => {
        searchSymbols(search, searchMode);
      }, 1000);
    } else {
      // For stocks with no search, clear results after a brief delay
      // This prevents flickering when opening the popover
      debounceRef.current = setTimeout(() => {
        setResults([]);
      }, 50);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [search, searchMode, searchSymbols, open]);

  // Trigger immediate search when switching to crypto/metals mode
  useEffect(() => {
    if (open && (searchMode === "crypto" || searchMode === "metals") && !search.trim()) {
      // Immediately search for crypto/metals when switching modes (bypass debounce)
      searchSymbols("", searchMode);
    }
  }, [searchMode, open, search, searchSymbols]);

  // Fetch price when selecting a ticker
  const handleSelect = async (result: TickerResult) => {
    // Only stocks require API key
    if (!hasApiKey && searchMode === "stocks") return;

    setIsLoadingPrice(true);
    setOpen(false);
    setSearch("");
    setError(null);

    try {
      let endpoint: string;
      if (searchMode === "crypto") {
        endpoint = `/api/crypto/${encodeURIComponent(result.symbol)}`;
      } else if (searchMode === "metals") {
        endpoint = `/api/metals/${encodeURIComponent(result.symbol)}`;
      } else {
        endpoint = `/api/stock/${encodeURIComponent(result.symbol)}`;
      }

      const response = await fetch(endpoint);

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to fetch price");
        setIsLoadingPrice(false);
        return;
      }

      onSelect({
        symbol: result.symbol,
        name: data.name || result.name,
        price: data.price,
        currency: data.currency,
        isInternational: data.isInternational,
        tickerType: searchMode === "crypto" ? "crypto" : searchMode === "metals" ? "metal" : "stock",
      });
    } catch (err) {
      console.error("Price fetch error:", err);
      setError("Failed to fetch price");
    } finally {
      setIsLoadingPrice(false);
    }
  };

  // Clear selection
  const handleClear = () => {
    onSelect(null);
    setSearch("");
    setResults([]);
    setError(null);
  };

  // Handle mode change
  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    setSearch("");
    setResults([]);
    setError(null);
    setHighlightedIndex(0);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results[highlightedIndex]) {
          handleSelect(results[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (open && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-result-item]');
      items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, open]);

  // Focus input when popover opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // If we have a selected value, show the confirmation card
  if (value) {
    return (
      <InfoCard
        variant="success"
        title={value.name}
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleClear}
            title="Clear and search again"
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        }
      >
        {value.symbol} · {value.currency}{" "}
        {value.price.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </InfoCard>
    );
  }

  // Show loading state while fetching price
  if (isLoadingPrice) {
    return (
      <InfoCard variant="default" icon={<Loader2 className="h-4 w-4 animate-spin" />}>
        Loading price...
      </InfoCard>
    );
  }

  // Show error state if price fetch failed
  if (error && !open) {
    return (
      <InfoCard
        variant="danger"
        action={
          <Button type="button" variant="ghost" size="sm" onClick={() => setError(null)}>
            Try again
          </Button>
        }
      >
        {error}
      </InfoCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <Tabs value={searchMode} onValueChange={(value) => handleModeChange(value as SearchMode)}>
        <TabsList className="w-fit">
          <TabsTrigger value="stocks">Stocks</TabsTrigger>
          <TabsTrigger value="crypto">Crypto</TabsTrigger>
          <TabsTrigger value="metals">Metals</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* API key warning for stocks mode */}
      {!hasApiKey && searchMode === "stocks" && (
        <InfoCard variant="warning">
          Finnhub API key required for stock search.{" "}
          <Link href="/settings" className="text-primary underline underline-offset-2 hover:text-primary/80">
            Add one in Settings
          </Link>
        </InfoCard>
      )}

      {/* Search input */}
      <div className="space-y-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  searchMode === "crypto"
                    ? "Search crypto..."
                    : searchMode === "metals"
                      ? "Search metals..."
                      : "Search stocks..."
                }
                className="pl-9"
                disabled={disabled || (!hasApiKey && searchMode === "stocks")}
                onFocus={() => setOpen(true)}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div ref={listRef} className="max-h-[300px] overflow-y-auto">
              {error && (
                <div className="p-4 text-sm text-destructive">{error}</div>
              )}
              {!error && results.length === 0 && search.trim() && !isSearching && (
                <div className="p-4 text-sm text-muted-foreground">
                  No results found for &quot;{search}&quot;
                </div>
              )}
              {!error && results.length === 0 && !search.trim() && !isSearching && searchMode === "stocks" && (
                <div className="p-4 text-sm text-muted-foreground">
                  Type to search for stocks and ETFs...
                </div>
              )}
              {!error && results.length === 0 && !isSearching && searchMode === "metals" && (
                <div className="p-4 text-sm text-muted-foreground">
                  Loading metals...
                </div>
              )}
              {results.map((result, index) => (
                <div
                  key={result.symbol}
                  data-result-item
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors",
                    index === highlightedIndex && "bg-accent",
                    "hover:bg-accent"
                  )}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium">
                        {searchMode === "crypto" ? result.displaySymbol : result.symbol}
                      </span>
                      <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                        {result.type}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{result.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <p className="text-xs text-muted-foreground">
          {searchMode === "crypto"
            ? "Prices from CoinGecko · e.g. Bitcoin, Ethereum, Solana"
            : searchMode === "metals"
              ? "Prices from Gold API · Gold, Silver, Platinum, Palladium"
              : "Prices from Finnhub · e.g. AAPL, MSFT, VTI, SPY"
          }
        </p>
      </div>
    </div>
  );
}
