"use client";

import { useMemo, useState } from "react";
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
import { GripVertical, Trash2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { InlineRename, AddInline } from "./inline-edit";
import type { DbBudgetGroup, DbBudgetSubcategory, DbBudgetItem } from "@/lib/db/types";
import {
  useBudgetHierarchy,
  reorderGroups,
  reorderSubcategories,
  reorderItems,
  createGroup,
  createSubcategory,
  createItem,
  updateGroup,
  updateSubcategory,
  deleteGroup,
  deleteSubcategory,
} from "@/hooks/use-budget";
import type { BudgetTreeItem } from "@/lib/budget/types";

/**
 * Manage-mode hierarchy editor: within-parent drag reorder at all three levels,
 * inline add + rename, and delete (with affected-count confirms). Item-level
 * detail (keywords/target/move/archive/delete) is opened via onOpenDetail.
 */
export function ManageTree({ onOpenDetail }: { onOpenDetail: (item: BudgetTreeItem) => void }) {
  const hierarchy = useBudgetHierarchy(true);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { subsByGroup, itemsBySub } = useMemo(() => {
    const subsByGroup = new Map<number, DbBudgetSubcategory[]>();
    const itemsBySub = new Map<number, DbBudgetItem[]>();
    for (const s of hierarchy?.subcategories ?? []) {
      if (!subsByGroup.has(s.groupId)) subsByGroup.set(s.groupId, []);
      subsByGroup.get(s.groupId)!.push(s);
    }
    for (const i of hierarchy?.items ?? []) {
      if (!itemsBySub.has(i.subcategoryId)) itemsBySub.set(i.subcategoryId, []);
      itemsBySub.get(i.subcategoryId)!.push(i);
    }
    return { subsByGroup, itemsBySub };
  }, [hierarchy]);

  const groups = hierarchy?.groups ?? [];

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const [aType, aId] = String(active.id).split(":");
    const [oType, oId] = String(over.id).split(":");
    if (aType !== oType) return;
    try {
      if (aType === "group") await reorderGroups(Number(aId), Number(oId));
      else if (aType === "sub") await reorderSubcategories(Number(aId), Number(oId));
      else if (aType === "item") await reorderItems(Number(aId), Number(oId));
    } catch {
      toast.error("Failed to reorder");
    }
  };

  if (!hierarchy) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        <SortableContext items={groups.map((g) => `group:${g.id}`)} strategy={verticalListSortingStrategy}>
          {groups.map((group) => (
            <ManageGroup
              key={group.id}
              group={group}
              subs={subsByGroup.get(group.id!) ?? []}
              itemsBySub={itemsBySub}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </SortableContext>
        <AddInline label="Add group" onAdd={async (name) => { await createGroup(name); }} />
      </div>
    </DndContext>
  );
}

function ManageGroup({
  group,
  subs,
  itemsBySub,
  onOpenDetail,
}: {
  group: DbBudgetGroup;
  subs: DbBudgetSubcategory[];
  itemsBySub: Map<number, DbBudgetItem[]>;
  onOpenDetail: (item: BudgetTreeItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `group:${group.id}` });
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("overflow-hidden rounded-lg border bg-card", isDragging && "opacity-60")}
    >
      <div className="flex items-center gap-2 border-b px-2 py-2">
        <button className="-m-1.5 cursor-grab touch-none p-1.5 text-muted-foreground" {...attributes} {...listeners} aria-label="Drag group">
          <GripVertical className="h-4 w-4" />
        </button>
        <InlineRename value={group.name} onCommit={(name) => updateGroup(group.id!, { name })} className="font-semibold" />
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2 p-2">
        <SortableContext items={subs.map((s) => `sub:${s.id}`)} strategy={verticalListSortingStrategy}>
          {subs.map((sub) => (
            <ManageSubcategory key={sub.id} sub={sub} items={itemsBySub.get(sub.id!) ?? []} onOpenDetail={onOpenDetail} />
          ))}
        </SortableContext>
        <AddInline label="Add subcategory" small onAdd={async (name) => { await createSubcategory(name, group.id!); }} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${group.name}"?`}
        description="This deletes the group and all its subcategories and items. Assigned transactions become uncategorized."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          try {
            const res = await deleteGroup(group.id!);
            toast.success(res.transactions > 0 ? `Group deleted · ${res.transactions} transaction(s) uncategorized` : "Group deleted");
          } catch {
            toast.error("Failed to delete group");
          }
        }}
      />
    </div>
  );
}

function ManageSubcategory({
  sub,
  items,
  onOpenDetail,
}: {
  sub: DbBudgetSubcategory;
  items: DbBudgetItem[];
  onOpenDetail: (item: BudgetTreeItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `sub:${sub.id}` });
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-md border bg-background/40", isDragging && "opacity-60")}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button className="-m-1.5 cursor-grab touch-none p-1.5 text-muted-foreground" {...attributes} {...listeners} aria-label="Drag subcategory">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <InlineRename
          value={sub.name}
          onCommit={(name) => updateSubcategory(sub.id!, { name })}
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        />
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-1 px-2 pb-2">
        <SortableContext items={items.map((i) => `item:${i.id}`)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <ManageItem key={item.id} item={item} onOpenDetail={onOpenDetail} />
          ))}
        </SortableContext>
        <AddInline label="Add item" small onAdd={async (name) => { await createItem({ name, subcategoryId: sub.id! }); }} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${sub.name}"?`}
        description="This deletes the subcategory and its items. Assigned transactions become uncategorized."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          try {
            const res = await deleteSubcategory(sub.id!);
            toast.success(res.transactions > 0 ? `Subcategory deleted · ${res.transactions} transaction(s) uncategorized` : "Subcategory deleted");
          } catch {
            toast.error("Failed to delete subcategory");
          }
        }}
      />
    </div>
  );
}

function ManageItem({ item, onOpenDetail }: { item: DbBudgetItem; onOpenDetail: (item: BudgetTreeItem) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `item:${item.id}` });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/40", isDragging && "opacity-60")}
    >
      <button className="cursor-grab touch-none text-muted-foreground" {...attributes} {...listeners} aria-label="Drag item">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm"
        onClick={() =>
          onOpenDetail({
            id: item.id!,
            uuid: item.uuid,
            name: item.name,
            order: item.order,
            itemType: item.itemType,
            targetAmount: item.targetAmount ?? null,
            isActive: item.isActive,
            keywords: item.keywords ?? [],
            budgetId: null,
            planned: 0,
            actual: 0,
            cumulative: 0,
          })
        }
      >
        {item.itemType === "goal" && <Target className="h-3.5 w-3.5 shrink-0 text-primary" />}
        <span className="truncate">{item.name}</span>
        {!item.isActive && <span className="rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">archived</span>}
      </button>
    </div>
  );
}

