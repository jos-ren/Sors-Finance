"use client";

import { useState } from "react";
import { Trash2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
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
  /** Expected income for the month; amounts show their share of it. */
  income: number;
  pending: Map<number, string>;
  formatAmount: (n: number, showCode?: boolean) => string;
  onPlannedChange: (categoryId: number, value: string) => void;
  onOpenDetail: (category: DetailCategory) => void;
}

const effective = (id: number, saved: number, pending: Map<number, string>) =>
  parsePending(pending.get(id), saved);

/** Share of income as a short label ("12%", "<1%"); empty without income or amount. */
function formatIncomeShare(amount: number, income: number): string {
  if (income <= 0 || amount <= 0) return "";
  const pct = (amount / income) * 100;
  return pct < 0.5 ? "<1%" : `${Math.round(pct)}%`;
}
/** Full build + allocate list: drag-reorder + create/rename/delete groups,
 *  categories, and allocate amounts top-down. */
export function BuilderList({ groups, ...shared }: { groups: BuilderGroupData[] } & SharedProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // The group a category is dragged from, and the group it is currently over,
  // so a different group can light up as a drop target.
  const [dragFromGroup, setDragFromGroup] = useState<number | null>(null);
  const [overGroup, setOverGroup] = useState<number | null>(null);

  const groupOfSub = (subId: number) => groups.find((g) => g.categories.some((c) => c.category.id === subId))?.group.id;

  /** Group a drop target belongs to: a category row, or a group's drop zone. */
  const groupOfTarget = (id: string): number | undefined => {
    const [type, rawId] = id.split(":");
    if (type === "sub") return groupOfSub(Number(rawId));
    if (type === "groupdrop") return Number(rawId);
    return undefined;
  };

  const collisionDetection: CollisionDetection = (args) => {
    const activeType = String(args.active.id).split(":")[0];
    const containers = args.droppableContainers;
    if (activeType !== "sub") {
      return closestCenter({ ...args, droppableContainers: containers.filter((c) => String(c.id).startsWith(`${activeType}:`)) });
    }
    // A category can land on another category (any group) or on a group's drop
    // zone, which is how it reaches an empty group or the end of a list.
    const subs = containers.filter((c) => String(c.id).startsWith("sub:"));
    const zones = containers.filter((c) => String(c.id).startsWith("groupdrop:"));
    const hits = pointerWithin({ ...args, droppableContainers: [...subs, ...zones] });
    const subHits = hits.filter((c) => String(c.id).startsWith("sub:"));
    if (subHits.length > 0) return subHits;
    if (hits.length > 0) return hits;
    return closestCenter({ ...args, droppableContainers: subs });
  };

  const handleDragStart = (e: DragStartEvent) => {
    const [type, id] = String(e.active.id).split(":");
    if (type === "sub") setDragFromGroup(groupOfSub(Number(id)) ?? null);
  };

  const handleDragOver = (e: DragOverEvent) => {
    setOverGroup(e.over ? groupOfTarget(String(e.over.id)) ?? null : null);
  };

  const clearDrag = () => {
    setDragFromGroup(null);
    setOverGroup(null);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    clearDrag();
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const [aType, aId] = String(active.id).split(":");
    const [oType, oId] = String(over.id).split(":");
    try {
      if (aType === "group" && oType === "group") {
        await reorderGroups(Number(aId), Number(oId));
        return;
      }
      if (aType !== "sub") return;
      const fromGroup = groupOfSub(Number(aId));
      const toGroup = groupOfTarget(String(over.id));
      if (fromGroup === undefined || toGroup === undefined) return;

      if (fromGroup === toGroup) {
        if (oType === "sub") await reorderSubcategories(Number(aId), Number(oId));
        return;
      }

      // Different group: move it to the end of that group, then slide it into
      // place when it was dropped on a specific category.
      const target = groups.find((g) => g.group.id === toGroup);
      const nextOrder = target && target.categories.length > 0 ? Math.max(...target.categories.map((c) => c.category.order)) + 1 : 0;
      await updateSubcategory(Number(aId), { groupId: toGroup, order: nextOrder });
      if (oType === "sub") await reorderSubcategories(Number(aId), Number(oId), toGroup);
    } catch {
      toast.error("Failed to move category");
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragCancel={clearDrag}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          <SortableContext items={groups.map((g) => `group:${g.group.id}`)} strategy={verticalListSortingStrategy}>
            {groups.map((g) => (
              <BuilderGroup
                key={g.group.id}
                data={g}
                dropTarget={dragFromGroup !== null && overGroup === g.group.id && dragFromGroup !== g.group.id}
                {...shared}
              />
            ))}
          </SortableContext>
        </div>
        <AddInline label="Add group" onAdd={async (name) => { await createGroup(name); }} />
      </div>
    </DndContext>
  );
}

function BuilderGroup({ data, dropTarget, ...shared }: { data: BuilderGroupData; dropTarget: boolean } & SharedProps) {
  const { group, categories } = data;
  const { income, pending, formatAmount, onPlannedChange, onOpenDetail } = shared;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `group:${group.id}` });
  // The category area is also a drop zone, so a category can be dropped into an empty group.
  const { setNodeRef: setDropRef } = useDroppable({ id: `groupdrop:${group.id}` });

  const allocated = categories.reduce((a, { category, saved }) => a + effective(category.id!, saved, pending), 0);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("bg-card", isDragging && "opacity-60")}
    >
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <button className="-m-1 shrink-0 cursor-grab touch-none p-1 text-muted-foreground" {...attributes} {...listeners} aria-label="Drag category group">
              <GripVertical className="h-4 w-4" />
            </button>
            <InlineRename value={group.name} onCommit={(name) => updateGroup(group.id!, { name })} className="text-base font-semibold" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 text-right text-sm tabular-nums text-muted-foreground/70">
              {formatIncomeShare(allocated, income)}
            </span>
            <span className="cursor-default text-base font-medium tabular-nums">{formatAmount(allocated, false)}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div ref={setDropRef} className={cn("py-3 pr-4 transition-colors", dropTarget && "bg-primary/5")}>
        <div className="ml-4 min-h-8 divide-y divide-border/40 border-l-2 border-border/40 pl-4">
          <SortableContext items={categories.map(({ category }) => `sub:${category.id}`)} strategy={verticalListSortingStrategy}>
            {categories.map(({ category, saved }) => (
              <AllocationItemRow
                key={category.id}
                item={{
                  id: category.id!,
                  name: category.name,
                  itemType: category.itemType,
                  isRecurring: category.isRecurring,
                  planned: effective(category.id!, saved, pending),
                }}
                pendingValue={pending.get(category.id!)}
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
