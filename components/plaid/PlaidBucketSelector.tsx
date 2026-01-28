/**
 * PlaidBucketSelector Component
 * 
 * Dialog shown after Plaid Link completes to let users select:
 * 1. Which portfolio bucket each account goes into (Savings/Investments/Assets/Debt)
 * 2. Which portfolio account within that bucket (existing or new)
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxLabel,
  ComboboxGroup,
} from "@/components/ui/combobox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Plus } from "lucide-react";
import { toast } from "sonner";

type BucketType = "Savings" | "Investments" | "Assets" | "Debt";

interface PlaidAccount {
  id: number;
  accountId: string;
  name: string;
  officialName?: string | null;
  type: string;
  subtype: string;
  mask?: string | null;
  suggestedBucket: BucketType;
  currentBalance: number;
}

interface PortfolioAccount {
  id: number;
  name: string;
  bucket: BucketType;
}

interface AccountSelection {
  bucket: BucketType;
  accountName: string; // Can be existing account name or new account name typed by user
  itemName: string; // editable name for the portfolio item
}

interface PlaidBucketSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: PlaidAccount[];
  itemId: number;
  institutionName: string;
  onConfirm: () => void;
  mode?: 'create' | 'edit'; // Add mode support
  existingMappings?: Map<number, { bucket: BucketType; accountName: string; itemName: string }>; // For edit mode
}

export function PlaidBucketSelector({
  open,
  onOpenChange,
  accounts,
  itemId,
  institutionName,
  onConfirm,
  mode = 'create',
  existingMappings,
}: PlaidBucketSelectorProps) {
  // State for account selections
  const [accountSelections, setAccountSelections] = useState<Map<number, AccountSelection>>(new Map());
  const [portfolioAccounts, setPortfolioAccounts] = useState<PortfolioAccount[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  // Initialize account selections when dialog opens with accounts
  useEffect(() => {
    if (open && accounts.length > 0) {
      setAccountSelections(
        new Map(accounts.map(acc => {
          // Use existing mapping if in edit mode, otherwise use defaults
          const existing = existingMappings?.get(acc.id);
          return [
            acc.id, 
            existing || { 
              bucket: acc.suggestedBucket, 
              accountName: '', // Default to empty - user must select
              itemName: '' // Default to empty - user must type
            }
          ];
        }))
      );
    }
  }, [open, accounts, institutionName, existingMappings]);

  // Load existing portfolio accounts
  useEffect(() => {
    if (open) {
      loadPortfolioAccounts();
    }
  }, [open]);

  // Ensure scroll is always enabled when dialog state changes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        document.body.style.overflow = '';
        document.body.style.removeProperty('overflow');
      }, 100);
    }
  }, [open]);

  const loadPortfolioAccounts = async () => {
    try {
      setIsLoadingAccounts(true);
      const response = await fetch('/api/portfolio/accounts');
      if (!response.ok) throw new Error('Failed to load portfolio accounts');
      const result = await response.json();
      setPortfolioAccounts(result.data || []); // API returns { data: accounts }
    } catch (error) {
      console.error('Failed to load portfolio accounts:', error);
      toast.error('Failed to load existing accounts');
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handleBucketChange = (accountId: number, bucket: BucketType) => {
    console.log('handleBucketChange called:', { accountId, bucket });
    setAccountSelections(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(accountId)!;
      // Reset account selection when bucket changes
      newMap.set(accountId, {
        ...current,
        bucket,
        accountName: '', // Clear account selection
      });
      return newMap;
    });
  };

  const handleAccountSelectionChange = (accountId: number, value: string) => {
    console.log('handleAccountSelectionChange:', { accountId, value });
    setAccountSelections(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(accountId)!;
      
      if (value === '__CREATE_NEW__') {
        // User wants to create new - prefill with institution name
        newMap.set(accountId, {
          ...current,
          accountName: institutionName,
        });
      } else {
        // User selected existing account
        newMap.set(accountId, {
          ...current,
          accountName: value,
        });
      }
      return newMap;
    });
  };

  const handleAccountNameChange = (accountId: number, value: string) => {
    console.log('handleAccountNameChange called:', { accountId, value });
    setAccountSelections(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(accountId)!;
      newMap.set(accountId, {
        ...current,
        accountName: value,
      });
      console.log('Updated accountName to:', value);
      return newMap;
    });
  };

  const handleItemNameChange = (accountId: number, name: string) => {
    setAccountSelections(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(accountId)!;
      newMap.set(accountId, {
        ...current,
        itemName: name,
      });
      return newMap;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getAccountsForBucket = (bucket: BucketType) => {
    return portfolioAccounts.filter(acc => acc.bucket === bucket);
  };

  const handleConfirm = async () => {
    // Validate all selections
    for (const [accountId, selection] of accountSelections.entries()) {
      if (!selection.accountName?.trim()) {
        toast.error('Please provide an account name for all bank accounts');
        return;
      }
      if (!selection.itemName?.trim()) {
        toast.error('Please provide a name for all portfolio items');
        return;
      }
    }

    setIsCreating(true);

    try {
      // Prepare account mappings
      const accountMappings = Array.from(accountSelections.entries()).map(([accountId, selection]) => {
        // Check if account name matches an existing portfolio account
        const existingAccount = portfolioAccounts.find(
          acc => acc.bucket === selection.bucket && acc.name === selection.accountName
        );

        return {
          plaidAccountId: accountId,
          bucket: selection.bucket,
          portfolioAccountId: existingAccount?.id || null,
          newAccountName: existingAccount ? undefined : selection.accountName,
          itemName: selection.itemName,
        };
      });

      // Call API to create portfolio accounts/items
      const response = await fetch("/api/plaid/create-portfolio-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          accountMappings,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create portfolio accounts");
      }

      const data = await response.json();
      
      toast.success(`Successfully added ${data.created} account${data.created !== 1 ? 's' : ''} to portfolio`);
      onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create portfolio accounts:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create portfolio accounts");
    } finally {
      setIsCreating(false);
    }
  };

  const getBucketColor = (bucket: BucketType) => {
    switch (bucket) {
      case "Savings":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Investments":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Assets":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "Debt":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onCloseAutoFocus={(e) => {
        setTimeout(() => {
          document.body.style.overflow = '';
          document.body.style.removeProperty('overflow');
        }, 0);
      }}>
        <DialogHeader>
          <DialogTitle>
            Map {accounts.length} account{accounts.length !== 1 ? 's' : ''} from {institutionName}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit' 
              ? 'Update the item name, bucket, and portfolio account for each bank account.'
              : 'Set the item name, bucket, and portfolio account for each bank account.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {accounts.map((account) => {
            const selection = accountSelections.get(account.id);
            if (!selection) return null; // Skip if not initialized yet
            
            console.log(`Rendering account ${account.id}, selection.accountName:`, selection.accountName);
            
            const availableAccounts = getAccountsForBucket(selection.bucket);

            return (
              <Card key={account.id} className="border-muted/50">
                <CardContent className="p-4 space-y-4">
                  {/* Account Info Header - Compact */}
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {account.officialName || account.name}
                        </p>
                        {account.mask && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            ••{account.mask}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {account.subtype} • {formatCurrency(account.currentBalance)}
                      </p>
                    </div>
                  </div>

                  {/* Form Fields - 2x2 Grid */}
                  <div className="space-y-2">
                    {/* Row 1: Item Name | Bucket */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Item Name */}
                      <div className="space-y-1">
                        <Label htmlFor={`item-${account.id}`} className="text-xs text-muted-foreground">
                          Item Name
                        </Label>
                        <Input
                          id={`item-${account.id}`}
                          value={selection.itemName}
                          onChange={(e) => handleItemNameChange(account.id, e.target.value)}
                          placeholder="e.g., Chequing, Savings"
                          size="sm"
                          className="text-sm"
                        />
                      </div>

                      {/* Bucket */}
                      <div className="space-y-1">
                        <Label htmlFor={`bucket-${account.id}`} className="text-xs text-muted-foreground">
                          Bucket
                        </Label>
                        <Select
                          value={selection.bucket}
                          onValueChange={(value) => handleBucketChange(account.id, value as BucketType)}
                        >
                          <SelectTrigger id={`bucket-${account.id}`} size="sm" className="text-sm w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Savings">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${getBucketColor("Savings")}`} />
                                Savings
                              </div>
                            </SelectItem>
                            <SelectItem value="Investments">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${getBucketColor("Investments")}`} />
                                Investments
                              </div>
                            </SelectItem>
                            <SelectItem value="Assets">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${getBucketColor("Assets")}`} />
                                Assets
                              </div>
                            </SelectItem>
                            <SelectItem value="Debt">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${getBucketColor("Debt")}`} />
                                Debt
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Row 2: Account | New Account Name (conditional) */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Account Selection */}
                      <div className="space-y-1">
                        <Label htmlFor={`account-select-${account.id}`} className="text-xs text-muted-foreground">
                          Account
                        </Label>
                        <Select
                          value={
                            selection.accountName === '' 
                              ? '' 
                              : availableAccounts.find(acc => acc.name === selection.accountName)
                              ? selection.accountName
                              : '__CREATE_NEW__'
                          }
                          onValueChange={(value) => handleAccountSelectionChange(account.id, value)}
                        >
                          <SelectTrigger id={`account-select-${account.id}`} size="sm" className="text-sm w-full">
                            <SelectValue placeholder="Select account..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__CREATE_NEW__">Create New Account</SelectItem>
                            {availableAccounts.length > 0 && (
                              <>
                                <SelectSeparator />
                                {availableAccounts.map((acc) => (
                                  <SelectItem key={acc.id} value={acc.name}>
                                    {acc.name}
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* New Account Name Input - Only show if creating new */}
                      {selection.accountName !== '' && !availableAccounts.find(acc => acc.name === selection.accountName) && (
                        <div className="space-y-1">
                          <Label htmlFor={`account-name-${account.id}`} className="text-xs text-muted-foreground">
                            New Account Name
                          </Label>
                          <Input
                            id={`account-name-${account.id}`}
                            value={selection.accountName}
                            onChange={(e) => handleAccountNameChange(account.id, e.target.value)}
                            placeholder="e.g., CIBC Accounts"
                            size="sm"
                            className="text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
                </Card>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={isCreating || isLoadingAccounts}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                {mode === 'edit' ? 'Updating...' : 'Adding...'}
              </>
            ) : (
              mode === 'edit' ? 'Save Changes' : `Add ${accounts.length} to Portfolio`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
