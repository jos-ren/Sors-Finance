"use client";

import { useState } from "react";
import { Trash2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DbBudgetGroup, DbBudgetSubcategory } from "@/lib/db/types";
import { parsePending } from "@/lib/budget/effective-tree";
import {
  createGroup,
  createSubcategory,
  updateGroup,
  updateSubcategory,
  deleteGroup,
  deleteSubcategory,
  reorderGroups,
  reorderSubcategories,
} from "@/hooks/use-budget";
import { InlineRename, AddInline } from "@/components/features/budget/manage/inline-edit";
import { AllocationItemRow } from "./allocation-item-row";
import type { DetailCategory } from "@/components/features/budget/category-detail-dialog";

export interface BuilderCategoryData {
  category: DbBudgetSubcategory;
  saved: number;
}
export interface BuilderGroupData {
  group: DbBudgetGroup;
  categories: BuilderCategoryData[];
}

interface SharedProps {
  income: number;
  pending: Map<number, string>;
  formatAmount: (n: number) => string;
  onPlannedChange: (categoryId: number, value: string) => void;
  onOpenDetail: (category: DetailCategory) => void;
}

const effective = (id: number, saved: number, pending: Map<number, string>) =>
  parsePending(pending.get(id), saved);

/** Full build + allocate list: drag-reorder + create/rename/delete groups,
 *  categories, and allocate amounts top-down. */
export function BuilderList({ groups, ...shared }: { groups: BuilderGroupData[] } & SharedProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const [aType, aId] = String(active.id).split(":");
    const [oType, oId] = String(over.id).split(":");
    if (aType !== oType) return;
    try {
      if (aType === "group") await reorderGroups(Number(aId), Number(oId));
      else if (aType === "sub") await reorderSubcategories(Number(aId), Number(oId));
    } catch {
      toast.error("Failed to reorder");
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <SortableContext items={groups.map((g) => `group:${g.group.id}`)} strategy={verticalListSortingStrategy}>
          {groups.map((g) => (
            <BuilderGroup key={g.group.id} data={g} {...shared} />
          ))}
        </SortableContext>
        <AddInline label="Add group" onAdd={async (name) => { await createGroup(name); }} />
      </div>
    </DndContext>
  );
}

function BuilderGroup({ data, ...shared }: { data: BuilderGroupData } & SharedProps) {
  const { group, categories } = data;
  const { income, pending, formatAmount, onPlannedChange, onOpenDetail } = shared;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `group:${group.id}` });

  const allocated = categories.reduce((a, { category, saved }) => a + effective(category.id!, saved, pending), 0);
  const pct = income > 0 ? (allocated / income) * 100 : 0;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("overflow-hidden rounded-xl border bg-card", isDragging && "opacity-60")}
    >
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <button className="-m-1 shrink-0 cursor-grab touch-none p-1 text-muted-foreground" {...attributes} {...listeners} aria-label="Drag category group">
              <GripVertical className="h-4 w-4" />
            </button>
            <InlineRename value={group.name} onCommit={(name) => updateGroup(group.id!, { name })} className="font-semibold" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium tabular-nums">{formatAmount(allocated)}</span>
            {income > 0 && <span className="text-xs text-muted-foreground tabular-nums">{pct.toFixed(0)}%</span>}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </div>

      <div className="py-3 pr-4">
        <div className="ml-4 divide-y divide-border/40 border-l-2 border-border/40 pl-4">
          <SortableContext items={categories.map(({ category }) => `sub:${category.id}`)} strategy={verticalListSortingStrategy}>
            {categories.map(({ category, saved }) => (
              <AllocationItemRow
                key={category.id}
                item={{ id: category.id!, name: category.name, itemType: category.itemType, planned: effective(category.id!, saved, pending) }}
                income={income}
                pendingValue={pending.get(category.id!)}
                dirty={pending.has(category.id!)}
                formatAmount={formatAmount}
                onChange={(v) => onPlannedChange(category.id!, v)}
                onRename={(name) => updateSubcategory(category.id!, { name })}
                onOpenDetail={() =>
                  onOpenDetail({
                    id: category.id!,
                    name: category.name,
                    itemType: category.itemType,
                    targetAmount: category.targetAmount ?? null,
                    isActive: category.isActive,
                    keywords: category.keywords ?? [],
                    groupId: category.groupId,
                  })
                }
              />
            ))}
          </SortableContext>
        </div>
        <div className="ml-4 mt-2 pl-4">
          <AddInline small label="Add category" onAdd={async (name) => { await createSubcategory(name, group.id!); }} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${group.name}"?`}
        description="Deletes the category group and all its categories. Assigned transactions become uncategorized."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          try {
            const res = await deleteGroup(group.id!);
            toast.success(res.transactions > 0 ? `Category group deleted · ${res.transactions} transaction(s) uncategorized` : "Category group deleted");
          } catch {
            toast.error("Failed to delete category group");
          }
        }}
      />
    </div>
  );
}
