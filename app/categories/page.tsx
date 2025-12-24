"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { CategoryManager } from "@/components/CategoryManager";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCategories,
  useTransactionCount,
  addCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  recategorizeTransactions,
  RecategorizeMode,
} from "@/lib/hooks";
import { toast, Toaster } from "sonner";

export default function CategoriesPage() {
  const categories = useCategories();
  const transactionCount = useTransactionCount();
  const [isRecategorizing, setIsRecategorizing] = useState(false);

  const handleRecategorize = async (mode: RecategorizeMode) => {
    setIsRecategorizing(true);
    try {
      const result = await recategorizeTransactions(mode);
      if (result.updated > 0) {
        toast.success(
          `Re-categorized ${result.updated} transaction${result.updated !== 1 ? 's' : ''}` +
          (result.conflicts > 0 ? ` (${result.conflicts} conflicts skipped)` : '')
        );
      } else if (result.conflicts > 0) {
        toast.warning(`No transactions updated. ${result.conflicts} had keyword conflicts.`);
      } else {
        toast.info('No transactions needed re-categorization.');
      }
    } catch (error) {
      toast.error('Failed to re-categorize transactions');
      console.error(error);
    } finally {
      setIsRecategorizing(false);
    }
  };

  const handleAddCategory = async (name: string, keywords: string[]) => {
    try {
      await addCategory(name, keywords);
      toast.success(`Category "${name}" created`);
    } catch (error) {
      toast.error("Failed to create category");
      console.error(error);
    }
  };

  const handleUpdateCategory = async (id: number, name: string, keywords: string[]) => {
    try {
      const result = await updateCategory(id, { name, keywords });

      // Build feedback message
      const changes: string[] = [];
      if (result.assigned > 0) {
        changes.push(`${result.assigned} assigned`);
      }
      if (result.uncategorized > 0) {
        changes.push(`${result.uncategorized} uncategorized`);
      }
      if (result.conflicts > 0) {
        changes.push(`${result.conflicts} conflicts`);
      }

      if (changes.length > 0) {
        toast.success(`Category "${name}" updated (${changes.join(', ')})`);
      } else {
        toast.success(`Category "${name}" updated`);
      }
    } catch (error) {
      toast.error("Failed to update category");
      console.error(error);
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
      console.error(error);
    }
  };

  const handleReorderCategories = async (activeId: number, overId: number) => {
    try {
      await reorderCategories(activeId, overId);
    } catch (error) {
      toast.error("Failed to reorder categories");
      console.error(error);
    }
  };

  return (
    <>
      <Toaster position="bottom-right" richColors />
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
            <p className="text-muted-foreground">
              Manage your transaction categories and keywords for auto-categorization
            </p>
          </div>
          {(transactionCount ?? 0) > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isRecategorizing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRecategorizing ? 'animate-spin' : ''}`} />
                  Re-categorize
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleRecategorize('uncategorized')}>
                  Uncategorized only
                  <span className="ml-2 text-xs text-muted-foreground">
                    Safe - won&apos;t change existing
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleRecategorize('all')}>
                  All transactions
                  <span className="ml-2 text-xs text-muted-foreground">
                    Re-applies all keywords
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="max-w-4xl">
          <CategoryManager
            categories={categories || []}
            onCategoryAdd={handleAddCategory}
            onCategoryUpdate={handleUpdateCategory}
            onCategoryDelete={handleDeleteCategory}
            onCategoryReorder={handleReorderCategories}
          />
        </div>
      </div>
    </>
  );
}
