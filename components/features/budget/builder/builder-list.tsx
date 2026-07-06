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
import type { DbBudgetGroup, DbBudgetSubcategory, DbBudgetItem } from "@/lib/db/types";
import { parsePending } from "@/lib/budget/effective-tree";
import {
  createGroup,
  createSubcategory,
  createItem,
  updateGroup,
  updateSubcategory,
  updateItem,
  deleteGroup,
  deleteSubcategory,
  reorderGroups,
  reorderSubcategories,
  reorderItems,
} from "@/hooks/use-budget";
import { InlineRename, AddInline } from "@/components/features/budget/manage/inline-edit";
import { AllocationItemRow } from "./allocation-item-row";
import type { DetailItem } from "@/components/features/budget/item-detail-dialog";

export interface BuilderItemData {
  item: DbBudgetItem;
  saved: number;
}
export interface BuilderSubData {
  sub: DbBudgetSubcategory;
  items: BuilderItemData[];
}
export interface BuilderGroupData {
  group: DbBudgetGroup;
  subs: BuilderSubData[];
}

interface SharedProps {
  income: number;
  leftToAssign: number;
  pending: Map<number, string>;
  formatAmount: (n: number) => string;
  onPlannedChange: (itemId: number, value: string) => void;
  onOpenDetail: (item: DetailItem) => void;
}

const effective = (id: number, saved: number, pending: Map<number, string>) =>
  parsePending(pending.get(id), saved);

/** Full build + allocate list: drag-reorder + create/rename/delete groups,
 *  subs, items and allocate amounts top-down. */
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
      else if (aType === "item") await reorderItems(Number(aId), Number(oId));
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
  const { group, subs } = data;
  const { income, formatAmount, pending } = shared;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `group:${group.id}` });

  const allocated = subs.reduce(
    (a, s) => a + s.items.reduce((b, { item, saved }) => b + effective(item.id!, saved, pending), 0),
    0
  );
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
            <button className="-m-1 shrink-0 cursor-grab touch-none p-1 text-muted-foreground" {...attributes} {...listeners} aria-label="Drag group">
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

      <div className="space-y-2 px-4 py-3">
        <SortableContext items={subs.map((s) => `sub:${s.sub.id}`)} strategy={verticalListSortingStrategy}>
          {subs.map((s) => (
            <BuilderSub key={s.sub.id} data={s} {...shared} />
          ))}
        </SortableContext>
        <AddInline small label="Add subcategory" onAdd={async (name) => { await createSubcategory(name, group.id!); }} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${group.name}"?`}
        description="Deletes the group and all its subcategories and items. Assigned transactions become uncategorized."
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

function BuilderSub({ data, ...shared }: { data: BuilderSubData } & SharedProps) {
  const { sub, items } = data;
  const { income, leftToAssign, pending, formatAmount, onPlannedChange, onOpenDetail } = shared;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `sub:${sub.id}` });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-md border bg-background/40 px-3 py-2", isDragging && "opacity-60")}
    >
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-1.5">
          <button className="-m-1 shrink-0 cursor-grab touch-none p-1 text-muted-foreground" {...attributes} {...listeners} aria-label="Drag subcategory">
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <InlineRename
            value={sub.name}
            onCommit={(name) => updateSubcategory(sub.id!, { name })}
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-1 divide-y divide-border/40">
        <SortableContext items={items.map(({ item }) => `item:${item.id}`)} strategy={verticalListSortingStrategy}>
          {items.map(({ item, saved }) => (
            <AllocationItemRow
            key={item.id}
            item={{ id: item.id!, name: item.name, itemType: item.itemType, planned: effective(item.id!, saved, pending) }}
            income={income}
            leftToAssign={leftToAssign}
            pendingValue={pending.get(item.id!)}
            dirty={pending.has(item.id!)}
            formatAmount={formatAmount}
            onChange={(v) => onPlannedChange(item.id!, v)}
            onRename={(name) => updateItem(item.id!, { name })}
            onOpenDetail={() =>
              onOpenDetail({
                id: item.id!,
                name: item.name,
                itemType: item.itemType,
                targetAmount: item.targetAmount ?? null,
                isActive: item.isActive,
                keywords: item.keywords ?? [],
                subcategoryId: item.subcategoryId,
              })
            }
          />
          ))}
        </SortableContext>
      </div>

      <AddInline small label="Add item" onAdd={async (name) => { await createItem({ name, subcategoryId: sub.id! }); }} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${sub.name}"?`}
        description="Deletes the subcategory and its items. Assigned transactions become uncategorized."
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
