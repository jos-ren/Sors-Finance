"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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

/** Full build + allocate list: create/rename/delete groups, subs, items and
 *  allocate amounts top-down. */
export function BuilderList({ groups, ...shared }: { groups: BuilderGroupData[] } & SharedProps) {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <BuilderGroup key={g.group.id} data={g} {...shared} />
      ))}
      <AddInline label="Add group" onAdd={async (name) => { await createGroup(name); }} />
    </div>
  );
}

function BuilderGroup({ data, ...shared }: { data: BuilderGroupData } & SharedProps) {
  const { group, subs } = data;
  const { income, formatAmount, pending } = shared;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const allocated = subs.reduce(
    (a, s) => a + s.items.reduce((b, { item, saved }) => b + effective(item.id!, saved, pending), 0),
    0
  );
  const pct = income > 0 ? (allocated / income) * 100 : 0;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <InlineRename value={group.name} onCommit={(name) => updateGroup(group.id!, { name })} className="font-semibold" />
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
        {subs.map((s) => (
          <BuilderSub key={s.sub.id} data={s} {...shared} />
        ))}
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

  return (
    <div className="rounded-md border bg-background/40 px-3 py-2">
      <div className="flex items-center justify-between">
        <InlineRename
          value={sub.name}
          onCommit={(name) => updateSubcategory(sub.id!, { name })}
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        />
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-1 divide-y divide-border/40">
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
