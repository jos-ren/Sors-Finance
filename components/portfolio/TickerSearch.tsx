"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, CheckCircle2, X, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useFinnhubApiKey } from "@/lib/settings-context";

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
}

type SearchMode = "stocks" | "crypto";

interface TickerSearchProps {
  value?: SelectedTicker | null;
  onSelect: (ticker: SelectedTicker | null) => void;
  disabled?: boolean;
  hasApiKey: boolean;
}

export function TickerSearch({ value, onSelect, disabled, hasApiKey }: TickerSearchProps) {
  const apiKey = useFinnhubApiKey();
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
    if (!apiKey) {
      setError("API key required");
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const endpoint = mode === "crypto"
        ? `/api/crypto/search?q=${encodeURIComponent(query)}`
        : `/api/stock/search?q=${encodeURIComponent(query)}`;

      const response = await fetch(endpoint, {
        headers: { 'x-finnhub-key': apiKey },
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.code === 'RATE_LIMIT') {
          setError("Rate limit - try again shortly");
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
  }, [apiKey]);

  // Debounced search effect
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // For crypto, show popular results even without search query
    if (searchMode === "crypto" && !search.trim()) {
      debounceRef.current = setTimeout(() => {
        searchSymbols("", searchMode);
      }, 100);
    } else if (search.trim()) {
      debounceRef.current = setTimeout(() => {
        searchSymbols(search, searchMode);
      }, 1000);
    } else {
      setResults([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [search, searchMode, searchSymbols]);

  // Re-search when mode changes
  useEffect(() => {
    if (open) {
      if (searchMode === "crypto") {
        searchSymbols(search, searchMode);
      } else if (search.trim()) {
        searchSymbols(search, searchMode);
      } else {
        setResults([]);
      }
    }
  }, [searchMode, open, search, searchSymbols]);

  // Fetch price when selecting a ticker
  const handleSelect = async (result: TickerResult) => {
    if (!apiKey) return;

    setIsLoadingPrice(true);
    setOpen(false);
    setSearch("");
    setError(null);

    try {
      const endpoint = searchMode === "crypto"
        ? `/api/crypto/${encodeURIComponent(result.symbol)}`
        : `/api/stock/${encodeURIComponent(result.symbol)}`;

      const response = await fetch(endpoint, {
        headers: { 'x-finnhub-key': apiKey },
      });

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
      <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/30">
        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{value.name}</p>
          <p className="text-xs text-muted-foreground">
            {value.symbol} · {value.currency} {value.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={handleClear}
          title="Clear and search again"
          disabled={disabled}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Show loading state while fetching price
  if (isLoadingPrice) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md bg-muted border">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading price...</p>
      </div>
    );
  }

  // Show error state if price fetch failed
  if (error && !open) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30">
          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // Show API key warning if not configured
  if (!hasApiKey) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/30">
        <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
        <p className="text-sm text-muted-foreground">
          API key required for ticker search. Add one in Settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchMode === "crypto"
                  ? "Search crypto..."
                  : "Search stocks..."
                }
                className="pl-9"
                disabled={disabled}
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
              <div className="p-3 text-sm text-destructive">{error}</div>
            )}
            {!error && results.length === 0 && search.trim() && !isSearching && (
              <div className="p-3 text-sm text-muted-foreground">
                No results found for &quot;{search}&quot;
              </div>
            )}
            {!error && results.length === 0 && !search.trim() && !isSearching && searchMode === "stocks" && (
              <div className="p-3 text-sm text-muted-foreground">
                Type to search for stocks and ETFs...
              </div>
            )}
            {results.map((result, index) => (
              <div
                key={result.symbol}
                data-result-item
                className={cn(
                  "flex items-center gap-3 px-3 py-2 cursor-pointer",
                  index === highlightedIndex && "bg-accent",
                  "hover:bg-accent"
                )}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
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

        {/* Mode toggle */}
        <div className="flex rounded-md border p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => handleModeChange("stocks")}
            className={cn(
              "px-2 py-1 text-xs font-medium rounded transition-colors",
              searchMode === "stocks"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground"
            )}
          >
            Stocks
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("crypto")}
            className={cn(
              "px-2 py-1 text-xs font-medium rounded transition-colors",
              searchMode === "crypto"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground"
            )}
          >
            Crypto
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {searchMode === "crypto"
          ? "Crypto prices from Binance (USDT pairs)"
          : "Search by company name or ticker"
        }
      </p>
    </div>
  );
}
