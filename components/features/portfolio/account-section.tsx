"use client";

import { useState } from "react";
import { ChevronDown, Plus, MoreHorizontal, Pencil, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  DbPortfolioAccount,
  usePortfolioItems,
  usePortfolioAccountTotal,
  deletePortfolioAccount,
  updatePortfolioAccount,
  usePlaidAccountStatuses,
} from '@/hooks/use-database';
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PortfolioItem } from "./portfolio-item";
import { AddItemDialog } from "./add-item-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { getBankLogo, resolveBankLogoSrc } from "@/lib/icons/bank-logos";
import { getAccountIcon } from "@/lib/icons/account-icons";

/* eslint-disable @next/next/no-img-element */
function AccountLogoIcon({ name }: { name: string }) {
  const [imgError, setImgError] = useState(false);
  const logoData = getBankLogo(name);
  const iconData = !logoData ? getAccountIcon(name) : null;
  const IconComponent = iconData?.icon ?? Building2;
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg cursor-pointer select-none overflow-hidden",
        logoData && !imgError ? logoData.bg : iconData ? iconData.bg : "bg-muted"
      )}
    >
      {logoData && !imgError ? (
        <img
          src={resolveBankLogoSrc(logoData)}
          alt={name}
          className="h-full w-full object-contain p-1.5 rounded-[10px]"
          onError={() => setImgError(true)}
        />
      ) : (
        <IconComponent
          className={cn("h-5 w-5", iconData && !logoData ? iconData.color : "text-muted-foreground")}
        />
      )}
    </div>
  );
}

interface AccountSectionProps {
  account: DbPortfolioAccount;
  defaultOpen?: boolean;
}

export function AccountSection({
  account,
  defaultOpen = false,
}: AccountSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showAddItem, setShowAddItem] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(account.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const items = usePortfolioItems(account.id);
  const total = usePortfolioAccountTotal(account.id);
  const { formatAmount } = usePrivacy();
  const userCurrency = useCurrency();

  const itemCount = items?.length ?? 0;
  const plaidStatuses = usePlaidAccountStatuses();

  // Derive Plaid status for this account from its items' linked plaid accounts
  const plaidStatus = (() => {
    if (!items) return null;
    const plaidIds = items.filter((i) => i.plaidAccountId).map((i) => i.plaidAccountId!);
    if (plaidIds.length === 0) return null;
    // If any linked institution needs attention, show that status
    for (const id of plaidIds) {
      const status = plaidStatuses.get(id);
      if (status && status !== "active") return status;
    }
    return "active";
  })();

  const handleDelete = async () => {
    try {
      await deletePortfolioAccount(account.id!);
      toast.success("Account deleted");
    } catch (error) {
      toast.error("Failed to delete account");
      console.error(error);
    }
  };

  const handleRename = async () => {
    if (!editName.trim() || editName.trim() === account.name) {
      setIsEditing(false);
      setEditName(account.name);
      return;
    }

    try {
      await updatePortfolioAccount(account.id!, { name: editName.trim() });
      setIsEditing(false);
      toast.success("Account renamed");
    } catch (error) {
      toast.error("Failed to rename account");
      console.error(error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditName(account.name);
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div>
          {/* Parent row */}
          <div className="group flex items-center gap-3 p-4">
            {/* Account icon — bank logo → keyword icon → generic fallback */}
            <CollapsibleTrigger asChild>
              <AccountLogoIcon name={account.name} />
            </CollapsibleTrigger>

            {/* Name + item count */}
            {isEditing ? (
              <div className="flex-1 min-w-0">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 w-48"
                  autoFocus
                />
              </div>
            ) : (
              <CollapsibleTrigger asChild>
                <div className="flex-1 min-w-0 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{account.name}</p>
                    {plaidStatus && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium",
                          plaidStatus === "active"
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            plaidStatus === "active" ? "bg-green-500" : "bg-red-500"
                          )}
                        />
                        {plaidStatus === "active" ? "Linked" : "Link Error"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </p>
                </div>
              </CollapsibleTrigger>
            )}

            {/* Right: actions + total + chevron */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); setShowAddItem(true); }}
              >
                <Plus className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <span className="text-sm font-semibold tabular-nums mx-1">
                {formatAmount(total ?? 0, userCurrency)}
              </span>

              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="cursor-pointer">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Expanded content */}
          <CollapsibleContent>
            <div className="border-t bg-muted/40 divide-y divide-border">
              {items && items.length > 0 ? (
                items.map((item) => (
                  <PortfolioItem key={item.id} item={item} bucket={account.bucket} />
                ))
              ) : (
                <p className="px-6 py-4 text-sm text-muted-foreground">
                  No items yet
                </p>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {showAddItem && (
        <AddItemDialog
          open={showAddItem}
          onOpenChange={setShowAddItem}
          accountId={account.id!}
          accountName={account.name}
          bucket={account.bucket}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Account?"
        description={`This will permanently delete "${account.name}" and all its items.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
