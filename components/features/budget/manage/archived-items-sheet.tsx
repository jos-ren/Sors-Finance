"use client";

import { ArchiveRestore, Target } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useBudgetHierarchy, restoreItem } from "@/hooks/use-budget";

/**
 * Browse archived budget items and restore them. Grouped by their subcategory.
 */
export function ArchivedItemsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const hierarchy = useBudgetHierarchy(true);
  const archived = (hierarchy?.items ?? []).filter((i) => !i.isActive);
  const subById = new Map((hierarchy?.subcategories ?? []).map((s) => [s.id, s]));
  const groupById = new Map((hierarchy?.groups ?? []).map((g) => [g.id, g]));

  const handleRestore = async (id: number, name: string) => {
    try {
      await restoreItem(id);
      toast.success(`Restored "${name}"`);
    } catch {
      toast.error("Failed to restore item");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Archived items</SheetTitle>
          <SheetDescription>Completed goals and retired items. Restore any to bring it back.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {archived.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No archived items.</p>
          ) : (
            <ul className="space-y-2">
              {archived.map((item) => {
                const sub = subById.get(item.subcategoryId);
                const group = sub ? groupById.get(sub.groupId) : undefined;
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm">
                        {item.itemType === "goal" && <Target className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        {item.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {group?.name ?? ""}{sub ? ` › ${sub.name}` : ""}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleRestore(item.id!, item.name)}>
                      <ArchiveRestore className="h-4 w-4" /> Restore
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
