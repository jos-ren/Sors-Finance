/**
 * PlaidAccountSelector Component
 * 
 * Allows users to select multiple accounts from multiple Plaid institutions and date range for transaction import.
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarIcon, Loader2, AlertCircle, Building2, ChevronDown, Info, CreditCard, PiggyBank, TrendingUp, Home } from "lucide-react";
import { format, subMonths, startOfMonth, addDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface PlaidInstitutionWithAccounts {
  id: number;
  institutionId: string;
  institutionName: string;
  status: string;
  lastSync?: Date | null;
  errorMessage?: string | null;
  accounts: Array<{
    id: number;
    accountId: string;
    name: string;
    officialName?: string | null;
    type: string;
    subtype: string;
    mask?: string | null;
    portfolioAccountId?: number | null;
    portfolioBucket?: string | null;
  }>;
}

const BUCKET_ICONS: Record<string, { icon: typeof PiggyBank; color: string; bgColor: string }> = {
  Savings: { icon: PiggyBank, color: "text-emerald-500", bgColor: "bg-emerald-500/20" },
  Investments: { icon: TrendingUp, color: "text-blue-500", bgColor: "bg-blue-500/20" },
  Assets: { icon: Home, color: "text-amber-500", bgColor: "bg-amber-500/20" },
  Debt: { icon: CreditCard, color: "text-red-500", bgColor: "bg-red-500/20" },
};

interface SelectedAccount {
  itemId: number;
  accountId: string;
  institutionName: string;
  accountName: string;
}

interface PlaidAccountSelectorProps {
  onFetchTransactions: (accountsByItem: Map<number, { accountIds: string[]; institutionName: string }>, startDate: string, endDate: string) => Promise<void>;
  onBack: () => void;
}

export function PlaidAccountSelector({ onFetchTransactions, onBack }: PlaidAccountSelectorProps) {
  const [plaidItems, setPlaidItems] = useState<PlaidInstitutionWithAccounts[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Map<string, SelectedAccount>>(new Map());
  const [expandedInstitutions, setExpandedInstitutions] = useState<Set<number>>(new Set());
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastImportDate, setLastImportDate] = useState<Date | null>(null);

  useEffect(() => {
    loadPlaidItems();
    loadLastImportDate();
  }, []);

  const loadLastImportDate = async () => {
    try {
      const response = await fetch("/api/settings?key=LAST_PLAID_IMPORT_DATE");
      if (response.ok) {
        const { data } = await response.json();
        if (data) {
          const lastDate = parseISO(data);
          setLastImportDate(lastDate);
          // Set default start date to day after last import
          setStartDate(addDays(lastDate, 1));
        } else {
          // No last import - default to first of last month
          setStartDate(startOfMonth(subMonths(new Date(), 1)));
        }
      } else {
        setStartDate(startOfMonth(subMonths(new Date(), 1)));
      }
    } catch {
      // Default to first of last month on error
      setStartDate(startOfMonth(subMonths(new Date(), 1)));
    }
  };


  const loadPlaidItems = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/plaid/institutions");
      if (!response.ok) throw new Error("Failed to load Plaid items");
      const data = await response.json();
      setPlaidItems(data.institutions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connected banks");
    } finally {
      setLoading(false);
    }
  };

  const toggleInstitution = (itemId: number) => {
    setExpandedInstitutions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleAccount = (itemId: number, accountId: string, institutionName: string, accountName: string, displayName?: string) => {
    setSelectedAccounts(prev => {
      const key = `${itemId}-${accountId}`;
      const newMap = new Map(prev);
      
      if (newMap.has(key)) {
        newMap.delete(key);
      } else {
        newMap.set(key, { itemId, accountId, institutionName, accountName: displayName || accountName });
      }
      
      return newMap;
    });
  };

  const toggleAllAccountsForInstitution = (item: PlaidInstitutionWithAccounts, checked: boolean) => {
    setSelectedAccounts(prev => {
      const newMap = new Map(prev);
      
      item.accounts.forEach(account => {
        const key = `${item.id}-${account.accountId}`;
        if (checked) {
          newMap.set(key, {
            itemId: item.id,
            accountId: account.accountId,
            institutionName: item.institutionName,
            accountName: account.officialName || account.name,
          });
        } else {
          newMap.delete(key);
        }
      });
      
      return newMap;
    });
  };

  const isInstitutionFullySelected = (item: PlaidInstitutionWithAccounts): boolean => {
    return item.accounts.every(account => {
      const key = `${item.id}-${account.accountId}`;
      return selectedAccounts.has(key);
    });
  };

  const isInstitutionPartiallySelected = (item: PlaidInstitutionWithAccounts): boolean => {
    const selectedCount = item.accounts.filter(account => {
      const key = `${item.id}-${account.accountId}`;
      return selectedAccounts.has(key);
    }).length;
    return selectedCount > 0 && selectedCount < item.accounts.length;
  };

  // Date validation
  const dateError = (() => {
    if (!startDate || !endDate) return null;
    if (startDate > endDate) return "Start date must be before end date";
    if (endDate > new Date()) return "End date cannot be in the future";
    return null;
  })();

  const handleFetch = async () => {
    if (selectedAccounts.size === 0 || !startDate || !endDate) {
      setError("Please select at least one account and date range");
      return;
    }

    // Validate date range
    if (startDate > endDate) {
      setError("Start date must be before end date");
      return;
    }

    if (endDate > new Date()) {
      setError("End date cannot be in the future");
      return;
    }

    setFetching(true);
    setError(null);

    try {
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");
      
      // Group selected accounts by itemId with institution name
      const accountsByItem = new Map<number, { accountIds: string[]; institutionName: string }>();
      selectedAccounts.forEach(({ itemId, accountId, institutionName }) => {
        if (!accountsByItem.has(itemId)) {
          accountsByItem.set(itemId, { accountIds: [], institutionName });
        }
        accountsByItem.get(itemId)!.accountIds.push(accountId);
      });

      // Pass all selections to parent at once (parent handles sequential fetching)
      await onFetchTransactions(accountsByItem, startDateStr, endDateStr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch transactions");
    } finally {
      setFetching(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="h-5 w-32 bg-muted animate-pulse rounded" />
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 bg-muted animate-pulse rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-5 w-24 bg-muted animate-pulse rounded" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-10 bg-muted animate-pulse rounded" />
            <div className="h-10 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (plaidItems.length === 0) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No bank accounts connected. Please connect a bank account in Settings first.
          </AlertDescription>
        </Alert>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Institution & Account Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Select Accounts</Label>
          <span className="text-sm text-muted-foreground">
            {selectedAccounts.size} selected
          </span>
        </div>
        <Card className="overflow-hidden p-0 gap-0">
          {plaidItems.map((item, index) => {
            const isExpanded = expandedInstitutions.has(item.id);
            const accountsSelected = item.accounts.filter(acc =>
              selectedAccounts.has(`${item.id}-${acc.accountId}`)
            ).length;

            return (
              <Collapsible
                key={item.id}
                open={isExpanded}
                onOpenChange={() => toggleInstitution(item.id)}
                className="m-0"
              >
                <CollapsibleTrigger asChild>
                  <div className={cn(index > 0 && "border-t")}>
                    <div className="flex items-center gap-3 p-[20px] cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-center h-9 w-9 rounded-md bg-muted">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.institutionName}</p>
                        <p className="text-xs text-muted-foreground">
                          {accountsSelected > 0
                            ? `${accountsSelected} of ${item.accounts.length} accounts selected`
                            : `${item.accounts.length} account${item.accounts.length !== 1 ? 's' : ''} available`
                          }
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">Select All</span>
                      <Checkbox
                        checked={isInstitutionFullySelected(item)}
                        onCheckedChange={(checked) => {
                          toggleAllAccountsForInstitution(item, checked as boolean);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "h-5 w-5",
                          isInstitutionPartiallySelected(item) && "data-[state=checked]:bg-primary/50"
                        )}
                      />
                      <ChevronDown className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isExpanded && "rotate-180"
                      )} />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t bg-muted/30">
                  {item.accounts.map((account) => {
                    const key = `${item.id}-${account.accountId}`;
                    const isSelected = selectedAccounts.has(key);
                    const displayName = account.officialName || account.name;
                    const bucketConfig = account.portfolioBucket ? BUCKET_ICONS[account.portfolioBucket] : null;
                    const Icon = bucketConfig?.icon || CreditCard;
                    const iconColor = bucketConfig?.color || "text-muted-foreground";
                    const bgColor = bucketConfig?.bgColor || "bg-muted";

                    return (
                      <div
                        key={account.id}
                        className={cn(
                          "flex items-center gap-3 pl-[40px] pr-[48px] py-[10px] cursor-pointer transition-colors",
                          isSelected
                            ? "bg-primary/10 hover:bg-primary/15"
                            : "hover:bg-accent/50"
                        )}
                        onClick={() => toggleAccount(item.id, account.accountId, item.institutionName, account.name, displayName)}
                      >
                        <div className={cn("flex items-center justify-center h-6 w-6 flex-shrink-0 -ml-[14px] mr-[6px] rounded-[6px]", bgColor)}>
                          <Icon className={cn("h-3.5 w-3.5", iconColor)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {account.subtype}{account.mask && ` ••${account.mask}`}
                          </p>
                        </div>
                        <Checkbox
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggleAccount(item.id, account.accountId, item.institutionName, account.name, displayName)}
                          className="h-5 w-5"
                        />
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </Card>
      </div>

      {/* Date Range Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Date Range</Label>
        <Card className="p-4 space-y-4">
          {lastImportDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
              <Info className="h-4 w-4 flex-shrink-0" />
              <span>Last Plaid import: {format(lastImportDate, "PPP")}</span>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => date > new Date() || (startDate ? date < startDate : false)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {dateError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{dateError}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Plaid typically provides up to 2 years of transaction history
          </p>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={fetching}>
          Back
        </Button>
        <Button
          onClick={handleFetch}
          disabled={selectedAccounts.size === 0 || !startDate || !endDate || fetching || !!dateError}
        >
          {fetching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching...
            </>
          ) : (
            `Fetch ${selectedAccounts.size} Account${selectedAccounts.size !== 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </div>
  );
}
