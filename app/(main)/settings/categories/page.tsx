"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { CategoryManager } from "@/components/CategoryManager";
import {
  useCategories,
  useTransactions,
  addCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  invalidateBudgets,
  type DbCategory,
} from "@/lib/hooks";
import { useSetPageHeader } from "@/lib/page-header-context";
import {
  SettingsBreadcrumb,
  SettingsPageHeader,
} from "@/components/settings/SettingsShared";

export default function CategoriesSettingsPage() {
  const sentinelRef = useSetPageHeader("Categories");
  const categories = useCategories();
  const transactions = useTransactions();
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);

  const getTransactionCountByCategory = (categoryUuid: string): number => {
    if (!transactions) return 0;
    return transactions.filter((t) => {
      const category = categories?.find((c) => c.id === t.categoryId);
      return category?.uuid === categoryUuid;
    }).length;
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

  const handleToggleBudgetExclusion = async (category: DbCategory) => {
    try {
      await updateCategory(category.id!, { excludeFromBudget: !category.excludeFromBudget });
      invalidateBudgets();
      toast.success(
        category.excludeFromBudget
          ? `"${category.name}" will now appear in budget`
          : `"${category.name}" hidden from budget`
      );
    } catch {
      toast.error("Failed to update category");
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
    <div className="p-6 space-y-8 overflow-x-hidden">
      <div ref={sentinelRef} className="h-0" />

      <SettingsBreadcrumb page="Categories" />

      <SettingsPageHeader
        title="Categories"
        description="Manage your transaction categories and keywords for auto-categorization."
        action={
          <Button size="sm" onClick={() => setIsAddCategoryOpen(true)}>
            <Plus className="h-3 w-3 mr-1.5" />
            Add Category
          </Button>
        }
      />

      <CategoryManager
        categories={categories || []}
        onCategoryAdd={handleAddCategory}
        onCategoryUpdate={handleUpdateCategory}
        onCategoryDelete={handleDeleteCategory}
        onCategoryReorder={handleReorderCategories}
        onToggleBudgetExclusion={handleToggleBudgetExclusion}
        getTransactionCount={getTransactionCountByCategory}
        addDialogOpen={isAddCategoryOpen}
        onAddDialogOpenChange={setIsAddCategoryOpen}
      />
    </div>
  );
}
