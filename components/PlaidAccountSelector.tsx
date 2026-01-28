/**
 * PlaidAccountSelector Component
 * 
 * Allows users to select multiple accounts from multiple Plaid institutions and date range for transaction import.
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarIcon, Loader2, AlertCircle, Building2, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";
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
  }>;
}

interface SelectedAccount {
  itemId: number;
  accountId: string;
  institutionName: string;
  accountName: string;
}

interface PlaidAccountSelectorProps {
  onFetchTransactions: (itemId: number, accountIds: string[], startDate: string, endDate: string) => Promise<void>;
  onBack: () => void;
}

export function PlaidAccountSelector({ onFetchTransactions, onBack }: PlaidAccountSelectorProps) {
  const [plaidItems, setPlaidItems] = useState<PlaidInstitutionWithAccounts[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Map<string, SelectedAccount>>(new Map());
  const [expandedInstitutions, setExpandedInstitutions] = useState<Set<number>>(new Set());
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(subMonths(new Date(), 1)));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlaidItems();
  }, []);

  // Auto-expand first institution and select all its accounts
  useEffect(() => {
    if (plaidItems.length > 0 && expandedInstitutions.size === 0) {
      const firstItem = plaidItems[0];
      setExpandedInstitutions(new Set([firstItem.id]));
      
      const newSelected = new Map<string, SelectedAccount>();
      firstItem.accounts.forEach(account => {
        const key = `${firstItem.id}-${account.accountId}`;
        newSelected.set(key, {
          itemId: firstItem.id,
          accountId: account.accountId,
          institutionName: firstItem.institutionName,
          accountName: account.name,
        });
      });
      setSelectedAccounts(newSelected);
    }
  }, [plaidItems, expandedInstitutions.size]);

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

  const toggleAccount = (itemId: number, accountId: string, institutionName: string, accountName: string) => {
    setSelectedAccounts(prev => {
      const key = `${itemId}-${accountId}`;
      const newMap = new Map(prev);
      
      if (newMap.has(key)) {
        newMap.delete(key);
      } else {
        newMap.set(key, { itemId, accountId, institutionName, accountName });
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
            accountName: account.name,
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

  const handleFetch = async () => {
    if (selectedAccounts.size === 0 || !startDate || !endDate) {
      setError("Please select at least one account and date range");
      return;
    }

    setFetching(true);
    setError(null);

    try {
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");
      
      // Group selected accounts by itemId
      const accountsByItem = new Map<number, string[]>();
      selectedAccounts.forEach(({ itemId, accountId }) => {
        if (!accountsByItem.has(itemId)) {
          accountsByItem.set(itemId, []);
        }
        accountsByItem.get(itemId)!.push(accountId);
      });

      // Fetch from each institution sequentially
      for (const [itemId, accountIds] of accountsByItem.entries()) {
        await onFetchTransactions(itemId, accountIds, startDateStr, endDateStr);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch transactions");
      throw err;
    } finally {
      setFetching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
        <Label className="text-base font-semibold">
          Select Accounts ({selectedAccounts.size} selected)
        </Label>
        <div className="space-y-2">
          {plaidItems.map((item) => (
            <Collapsible
              key={item.id}
              open={expandedInstitutions.has(item.id)}
              onOpenChange={() => toggleInstitution(item.id)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">{item.institutionName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.accounts.length} account{item.accounts.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Checkbox
                      checked={isInstitutionFullySelected(item)}
                      onCheckedChange={(checked) => {
                        toggleAllAccountsForInstitution(item, checked as boolean);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        isInstitutionPartiallySelected(item) && "data-[state=checked]:bg-primary/50"
                      )}
                    />
                    {expandedInstitutions.has(item.id) ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-2 border-t pt-3">
                    {item.accounts.map((account) => {
                      const key = `${item.id}-${account.accountId}`;
                      const isSelected = selectedAccounts.has(key);
                      
                      return (
                        <div
                          key={account.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors",
                            isSelected && "bg-accent/30 border-primary"
                          )}
                          onClick={() => toggleAccount(item.id, account.accountId, item.institutionName, account.name)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() => toggleAccount(item.id, account.accountId, item.institutionName, account.name)}
                          />
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{account.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {account.type} • {account.subtype}
                              {account.mask && ` • ••${account.mask}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      </div>

      {/* Date Range Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Date Range</Label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
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

          <div className="space-y-2">
            <Label>End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
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
        <p className="text-xs text-muted-foreground">
          Plaid typically provides up to 2 years of transaction history
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={fetching}>
          Back
        </Button>
        <Button
          onClick={handleFetch}
          disabled={selectedAccounts.size === 0 || !startDate || !endDate || fetching}
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
