"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DbPortfolioAccount,
  usePortfolioItems,
  usePortfolioAccountTotal,
  deletePortfolioAccount,
  updatePortfolioAccount,
} from "@/lib/hooks/useDatabase";
import { usePrivacy } from "@/lib/privacy-context";
import { PortfolioItem } from "./PortfolioItem";
import { AddItemDialog } from "./AddItemDialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface AccountSectionProps {
  account: DbPortfolioAccount;
  defaultOpen?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function AccountSection({ account, defaultOpen = true }: AccountSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showAddItem, setShowAddItem] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(account.name);

  const items = usePortfolioItems(account.id);
  const total = usePortfolioAccountTotal(account.id);
  const { formatAmount } = usePrivacy();

  const handleDelete = async () => {
    if (!confirm(`Delete "${account.name}" and all its items?`)) return;

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
        <div className="border rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-muted/30">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 hover:text-foreground/80 transition-colors flex-1 text-left">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {isEditing ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 w-48"
                    autoFocus
                  />
                ) : (
                  <span className="font-medium">{account.name}</span>
                )}
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <span className="font-semibold tabular-nums">
                {formatAmount(total ?? 0, formatCurrency)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowAddItem(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Content */}
          <CollapsibleContent>
            <div className="p-2">
              {items && items.length > 0 ? (
                <div className="space-y-1">
                  {items.map((item) => (
                    <PortfolioItem key={item.id} item={item} bucket={account.bucket} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No items yet
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => setShowAddItem(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <AddItemDialog
        open={showAddItem}
        onOpenChange={setShowAddItem}
        accountId={account.id!}
        accountName={account.name}
        bucket={account.bucket}
      />
    </>
  );
}
