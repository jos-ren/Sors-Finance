"use client";

import { useEffect, useState } from "react";
import { X, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import type { DbBudgetItem, BudgetItemType } from "@/lib/db/types";
import { useBudgetHierarchy, updateItem, deleteItem, archiveItem, restoreItem } from "@/hooks/use-budget";

export interface DetailItem {
  id: number;
  name: string;
  itemType: BudgetItemType;
  targetAmount: number | null;
  isActive: boolean;
  keywords: string[];
  subcategoryId?: number;
}

/**
 * Per-item detail editor: rename, expense/goal + target, keywords, move-to
 * (Group › Subcategory), archive/restore, delete. Structure mutations save
 * immediately with a toast.
 */
export function ItemDetailDialog({
  item,
  open,
  onOpenChange,
}: {
  item: DetailItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const hierarchy = useBudgetHierarchy(true);
  const [name, setName] = useState("");
  const [isGoal, setIsGoal] = useState(false);
  const [target, setTarget] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [groupId, setGroupId] = useState<number | undefined>();
  const [subcategoryId, setSubcategoryId] = useState<number | undefined>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const detailItem = hierarchy?.items.find((i) => i.id === item?.id) as DbBudgetItem | undefined;

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setIsGoal(item.itemType === "goal");
    setTarget(item.targetAmount != null ? String(item.targetAmount) : "");
    setKeywords(item.keywords ?? []);
    const sub = hierarchy?.subcategories.find((s) => s.id === (detailItem?.subcategoryId ?? item.subcategoryId));
    setSubcategoryId(sub?.id);
    setGroupId(sub?.groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, hierarchy]);

  if (!item) return null;

  const subsForGroup = hierarchy?.subcategories.filter((s) => s.groupId === groupId) ?? [];

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.some((k) => k.toLowerCase() === kw.toLowerCase())) {
      setKeywords([...keywords, kw]);
    }
    setKeywordInput("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateItem(item.id, {
        name: name.trim() || item.name,
        itemType: isGoal ? "goal" : "expense",
        targetAmount: isGoal && target ? parseFloat(target) : null,
        keywords,
        subcategoryId,
      });
      toast.success("Item updated");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    try {
      if (item.isActive) {
        await archiveItem(item.id);
        toast.success("Item archived");
      } else {
        await restoreItem(item.id);
        toast.success("Item restored");
      }
      onOpenChange(false);
    } catch {
      toast.error("Failed to update item");
    }
  };

  const handleDelete = async () => {
    try {
      const res = await deleteItem(item.id);
      toast.success(
        res.transactions > 0
          ? `Item deleted · ${res.transactions} transaction(s) uncategorized`
          : "Item deleted"
      );
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete item");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Item details</DialogTitle>
            <DialogDescription>Edit keywords, target, or move this item.</DialogDescription>
          </DialogHeader>

          <div className="-mr-2 flex-1 space-y-5 overflow-y-auto pr-2">
            <div className="space-y-1.5">
              <Label htmlFor="item-name">Name</Label>
              <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Savings goal</p>
                <p className="text-xs text-muted-foreground">Track lifetime progress toward a target</p>
              </div>
              <Switch checked={isGoal} onCheckedChange={setIsGoal} />
            </div>

            {isGoal && (
              <div className="space-y-1.5">
                <Label htmlFor="item-target">Target amount</Label>
                <CurrencyInput id="item-target" value={target} onChange={setTarget} placeholder="0.00" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Keywords</Label>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="gap-1">
                    {kw}
                    <button onClick={() => setKeywords(keywords.filter((k) => k !== kw))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {keywords.length === 0 && <span className="text-xs text-muted-foreground">No keywords</span>}
              </div>
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="Add keyword, press Enter"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Group</Label>
                <Select
                  value={groupId ? String(groupId) : ""}
                  onValueChange={(v) => {
                    const gid = parseInt(v, 10);
                    setGroupId(gid);
                    const firstSub = hierarchy?.subcategories.find((s) => s.groupId === gid);
                    setSubcategoryId(firstSub?.id);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Group" /></SelectTrigger>
                  <SelectContent>
                    {hierarchy?.groups.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subcategory</Label>
                <Select value={subcategoryId ? String(subcategoryId) : ""} onValueChange={(v) => setSubcategoryId(parseInt(v, 10))}>
                  <SelectTrigger><SelectValue placeholder="Subcategory" /></SelectTrigger>
                  <SelectContent>
                    {subsForGroup.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleArchiveToggle}>
                {item.isActive ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                {item.isActive ? "Archive" : "Restore"}
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${item.name}"?`}
        description="This permanently deletes the item and its planned amounts. Assigned transactions become uncategorized. To keep history, archive it instead."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
