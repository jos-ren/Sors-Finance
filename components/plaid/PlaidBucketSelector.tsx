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
import { Loader2, CreditCard, Plus, PiggyBank, TrendingUp, Home } from "lucide-react";
import { toast } from "sonner";
import { invalidatePortfolio } from "@/lib/hooks/useDatabase";
import { formatCurrencyShort } from "@/lib/formatters";

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
  // Track which accounts are explicitly in "create new" mode (not derived from name matching)
  const [creatingNewAccounts, setCreatingNewAccounts] = useState<Set<number>>(new Set());

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
              itemName: acc.officialName || acc.name // Pre-fill with official name or fallback to name
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
    
    // Remove from create-new mode when bucket changes (forces re-selection)
    setCreatingNewAccounts(prev => {
      const newSet = new Set(prev);
      newSet.delete(accountId);
      return newSet;
    });
    
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
    
    if (value === '__CREATE_NEW__') {
      // Track that this account is in create-new mode
      setCreatingNewAccounts(prev => new Set(prev).add(accountId));
      
      setAccountSelections(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(accountId)!;
        // User wants to create new - prefill with institution name
        newMap.set(accountId, {
          ...current,
          accountName: institutionName,
        });
        return newMap;
      });
    } else {
      // User selected existing account - remove from create-new mode
      setCreatingNewAccounts(prev => {
        const newSet = new Set(prev);
        newSet.delete(accountId);
        return newSet;
      });
      
      setAccountSelections(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(accountId)!;
        // User selected existing account
        newMap.set(accountId, {
          ...current,
          accountName: value,
        });
        return newMap;
      });
    }
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

        // Check if this account is currently mapped (has portfolioAccountId in existingMappings)
        const isMapped = existingMappings?.has(accountId);

        return {
          plaidAccountId: accountId,
          bucket: selection.bucket,
          portfolioAccountId: existingAccount?.id || null,
          newAccountName: existingAccount ? undefined : selection.accountName,
          itemName: selection.itemName,
          isMapped, // Track whether this account was previously mapped
        };
      });

      // In edit mode, split into two groups: mapped (update) vs unmapped (create)
      if (mode === 'edit') {
        const mappedAccounts = accountMappings.filter(m => m.isMapped);
        const unmappedAccounts = accountMappings.filter(m => !m.isMapped);

        let totalUpdated = 0;
        let totalCreated = 0;
        let totalFailed = 0;
        const allErrors: string[] = [];

        // Update existing mappings
        if (mappedAccounts.length > 0) {
          const updateResponse = await fetch("/api/plaid/update-portfolio-accounts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemId,
              accountMappings: mappedAccounts,
            }),
          });

          if (updateResponse.ok) {
            const updateData = await updateResponse.json();
            totalUpdated = updateData.updated || 0;
            totalFailed += updateData.failed || 0;
            if (updateData.errors) allErrors.push(...updateData.errors);
          } else {
            const error = await updateResponse.json();
            allErrors.push(error.error || 'Failed to update accounts');
          }
        }

        // Create new mappings for unmapped accounts
        if (unmappedAccounts.length > 0) {
          const createResponse = await fetch("/api/plaid/create-portfolio-accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemId,
              accountMappings: unmappedAccounts,
            }),
          });

          if (createResponse.ok) {
            const createData = await createResponse.json();
            totalCreated = createData.created || 0;
            totalFailed += createData.failed || 0;
            if (createData.errors) allErrors.push(...createData.errors);
          } else {
            const error = await createResponse.json();
            allErrors.push(error.error || 'Failed to create accounts');
          }
        }

        // Show combined results
        const totalSuccess = totalUpdated + totalCreated;
        if (totalSuccess > 0 && totalFailed === 0) {
          toast.success(`Successfully updated ${totalSuccess} account${totalSuccess !== 1 ? 's' : ''}`);
        } else if (totalSuccess > 0 && totalFailed > 0) {
          toast.warning(`Updated ${totalSuccess}, failed ${totalFailed}. ${allErrors[0] || ''}`);
        } else if (totalFailed > 0) {
          toast.error(`Failed to update: ${allErrors[0] || 'Unknown error'}`);
          return;
        } else {
          toast.info('No changes made');
          onOpenChange(false);
          return;
        }
      } else {
        // Create mode: use create endpoint for all accounts
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
          throw new Error(error.error || 'Failed to create portfolio accounts');
        }

        const data = await response.json();
        const count = data.created || 0;
        const failCount = data.failed || 0;

        if (count > 0 && failCount === 0) {
          toast.success(`Successfully added ${count} account${count !== 1 ? 's' : ''}`);
        } else if (count > 0 && failCount > 0) {
          toast.warning(`Added ${count}, failed ${failCount}. ${data.errors?.[0] || ''}`);
        } else if (failCount > 0) {
          toast.error(`Failed to create: ${data.errors?.[0] || 'Unknown error'}`);
          return;
        } else {
          toast.info('No changes made');
          onOpenChange(false);
          return;
        }
      }

      // Sync balances immediately after creating accounts so they don't show as $0
      if (mode === 'create') {
        fetch("/api/plaid/balances", { method: "POST" })
          .then(() => invalidatePortfolio())
          .catch((err) => console.error("Auto balance sync failed:", err));
      }

      // Invalidate portfolio cache to refresh UI
      invalidatePortfolio();

      onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create portfolio accounts:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create portfolio accounts");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onCloseAutoFocus={(e) => {
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

        <div className="space-y-4 py-3 overflow-y-auto flex-1 min-h-0 border-y -mx-6 px-6">
          {accounts.map((account) => {
            const selection = accountSelections.get(account.id);
            if (!selection) return null; // Skip if not initialized yet
            
            console.log(`Rendering account ${account.id}, selection.accountName:`, selection.accountName);
            
            const availableAccounts = getAccountsForBucket(selection.bucket);

            return (
              <Card key={account.id} className="border-muted/50">
                <CardContent className="px-4 py-2.5 space-y-3">
                  {/* Account Info Header */}
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="font-medium text-sm truncate flex-1 min-w-0">
                      {account.officialName || account.name}
                      {account.mask && <span className="text-muted-foreground font-normal ml-2">••{account.mask}</span>}
                    </p>
                    <span className="text-sm text-muted-foreground shrink-0">
                      {formatCurrencyShort(account.currentBalance)}
                    </span>
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
                                <PiggyBank className="h-3.5 w-3.5 text-emerald-500" />
                                Savings
                              </div>
                            </SelectItem>
                            <SelectItem value="Investments">
                              <div className="flex items-center gap-1.5">
                                <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                                Investments
                              </div>
                            </SelectItem>
                            <SelectItem value="Assets">
                              <div className="flex items-center gap-1.5">
                                <Home className="h-3.5 w-3.5 text-amber-500" />
                                Assets
                              </div>
                            </SelectItem>
                            <SelectItem value="Debt">
                              <div className="flex items-center gap-1.5">
                                <CreditCard className="h-3.5 w-3.5 text-red-500" />
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
                        {(() => {
                          const isCreatingNew = creatingNewAccounts.has(account.id);
                          const isExistingAccount = availableAccounts.some(acc => acc.name === selection.accountName);
                          
                          // Compute Select value:
                          // - Empty string if no selection yet
                          // - '__CREATE_NEW__' if in create-new mode
                          // - The account name if it's an existing account
                          const selectValue = selection.accountName === ''
                            ? ''
                            : isCreatingNew || !isExistingAccount
                            ? '__CREATE_NEW__'
                            : selection.accountName;

                          return (
                            <Select
                              value={selectValue}
                              onValueChange={(value) => {
                                handleAccountSelectionChange(account.id, value);
                              }}
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
                          );
                        })()}
                      </div>

                      {/* New Account Name Input - Only show if creating new */}
                      {creatingNewAccounts.has(account.id) && (
                        <div className="space-y-1">
                          <Label htmlFor={`account-name-${account.id}`} className="text-xs text-muted-foreground">
                            New Account Name
                          </Label>
                          <Input
                            id={`account-name-${account.id}`}
                            value={selection.accountName}
                            onChange={(e) => handleAccountNameChange(account.id, e.target.value)}
                            placeholder="e.g., My Bank Accounts"
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

        <div className="flex justify-center gap-2 pt-3">
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
