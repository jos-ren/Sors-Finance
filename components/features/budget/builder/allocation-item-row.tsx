"use client";

import { useState } from "react";
import { Target, Pencil, Trash2, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { InlineRename } from "@/components/features/budget/manage/inline-edit";
import { deleteSubcategory } from "@/hooks/use-budget";

export interface BuilderItem {
  id: number;
  name: string;
  itemType: "expense" | "goal";
  planned: number; // effective (pending overlaid upstream)
}

/**
 * Builder allocation row: a dedicated drag handle, inline rename,
 * a $ input, and edit/delete actions.
 */
export function AllocationItemRow({
  item,
  pendingValue,
  onChange,
  onRename,
  onOpenDetail,
}: {
  item: BuilderItem;
  pendingValue: string | undefined;
  onChange: (value: string) => void;
  onRename: (name: string) => void;
  onOpenDetail: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `sub:${item.id}` });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const planned = item.planned;
  const inputValue = pendingValue !== undefined ? pendingValue : planned ? planned.toFixed(2) : "";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2 py-1.5", isDragging && "opacity-60")}
    >
      <button className="-m-1 shrink-0 cursor-grab touch-none p-1 text-muted-foreground" {...attributes} {...listeners} aria-label={`Drag ${item.name}`}>
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <div className="flex min-w-0 flex-[2] items-center gap-1.5">
        {item.itemType === "goal" && <Target className="h-3.5 w-3.5 shrink-0 text-primary" />}
        <InlineRename value={item.name} onCommit={onRename} className="text-sm" />
      </div>

      <div className="relative w-28 shrink-0">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
        <CurrencyInput
          value={inputValue}
          onChange={onChange}
          placeholder="0.00"
          size="sm"
          className="h-8 pl-5 text-right text-sm tabular-nums"
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground"
        onClick={onOpenDetail}
        aria-label={`Edit ${item.name}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => setConfirmDelete(true)}
        aria-label={`Delete ${item.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${item.name}"?`}
        description="Deletes the category. Assigned transactions become uncategorized."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          try {
            const res = await deleteSubcategory(item.id);
            toast.success(res.transactions > 0 ? `Category deleted · ${res.transactions} transaction(s) uncategorized` : "Category deleted");
          } catch {
            toast.error("Failed to delete category");
          }
        }}
      />
    </div>
  );
}
