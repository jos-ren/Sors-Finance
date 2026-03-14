"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { CategoryManager } from "@/components/CategoryManager";
import {
  useCategories,
  useTransactionCount,
  useTransactions,
  addCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  recategorizeTransactions,
  type RecategorizeMode,
} from "@/lib/hooks";
import { useSetPageHeader } from "@/lib/page-header-context";
import {
  SettingsBreadcrumb,
  SettingsPageHeader,
} from "@/components/settings/SettingsShared";

export default function CategoriesSettingsPage() {
  const sentinelRef = useSetPageHeader("Categories");
  const categories = useCategories();
  const transactionCount = useTransactionCount();
  const transactions = useTransactions();
  const [isRecategorizing, setIsRecategorizing] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);

  const getTransactionCountByCategory = (categoryUuid: string): number => {
    if (!transactions) return 0;
    return transactions.filter((t) => {
      const category = categories?.find((c) => c.id === t.categoryId);
      return category?.uuid === categoryUuid;
    }).length;
  };

  const handleRecategorize = async (mode: RecategorizeMode) => {
    setIsRecategorizing(true);
    try {
      const result = await recategorizeTransactions(mode);
      if (result.updated > 0) {
        toast.success(
          `Re-categorized ${result.updated} transaction${result.updated !== 1 ? "s" : ""}` +
            (result.conflicts > 0 ? ` (${result.conflicts} conflicts skipped)` : "")
        );
      } else if (result.conflicts > 0) {
        toast.warning(`No transactions updated. ${result.conflicts} had keyword conflicts.`);
      } else {
        toast.info("No transactions needed re-categorization.");
      }
    } catch {
      toast.error("Failed to re-categorize transactions");
    } finally {
      setIsRecategorizing(false);
    }
  };

  const handleAddCategory = async (name: string, keywords: string[]) => {
    try {
      await addCategory(name, keywords);
      toast.success(`Category "${name}" created`);
    } catch {
      toast.error("Failed to create category");
    }
  };

  const handleUpdateCategory = async (id: number, name: string, keywords: string[]) => {
    try {
      const result = await updateCategory(id, { name, keywords });
      const changes: string[] = [];
      if (result.assigned > 0) changes.push(`${result.assigned} assigned`);
      if (result.uncategorized > 0) changes.push(`${result.uncategorized} uncategorized`);
      if (result.conflicts > 0) changes.push(`${result.conflicts} conflicts`);
      toast.success(`Category "${name}" updated${changes.length > 0 ? ` (${changes.join(", ")})` : ""}`);
    } catch {
      toast.error("Failed to update category");
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await deleteCategory(id);
      toast.success("Category deleted");
    } catch (error) {
      if (error instanceof Error && error.message.includes("System categories")) {
        toast.error("System categories cannot be deleted");
      } else {
        toast.error("Failed to delete category");
      }
    }
  };

  const handleReorderCategories = async (activeId: number, overId: number) => {
    try {
      await reorderCategories(activeId, overId);
    } catch {
      toast.error("Failed to reorder categories");
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div ref={sentinelRef} className="h-0" />

      <SettingsBreadcrumb page="Categories" />

      <SettingsPageHeader
        title="Categories"
        description="Manage your transaction categories and keywords for auto-categorization."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setIsAddCategoryOpen(true)}>
              <Plus className="h-3 w-3 mr-1.5" />
              Add Category
            </Button>
            {(transactionCount ?? 0) > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isRecategorizing}>
                    <RefreshCw className={`h-3 w-3 mr-1.5 ${isRecategorizing ? "animate-spin" : ""}`} />
                    Re-categorize
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuItem onClick={() => handleRecategorize("uncategorized")}>
                    Uncategorized only
                    <span className="ml-2 text-xs text-muted-foreground">
                      Safe — won&apos;t change existing
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleRecategorize("all")}>
                    All transactions
                    <span className="ml-2 text-xs text-muted-foreground">Re-applies all keywords</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      />

      <CategoryManager
        categories={categories || []}
        onCategoryAdd={handleAddCategory}
        onCategoryUpdate={handleUpdateCategory}
        onCategoryDelete={handleDeleteCategory}
        onCategoryReorder={handleReorderCategories}
        getTransactionCount={getTransactionCountByCategory}
        addDialogOpen={isAddCategoryOpen}
        onAddDialogOpenChange={setIsAddCategoryOpen}
      />
    </div>
  );
}
