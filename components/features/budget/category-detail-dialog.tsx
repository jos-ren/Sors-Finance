"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Trash2, Archive, ArchiveRestore, TriangleAlert, Pencil, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { BudgetItemType, Keyword, KeywordMatchMode } from "@/lib/db/types";
import { useBudgetHierarchy, updateSubcategory, deleteSubcategory, archiveSubcategory, restoreSubcategory } from "@/hooks/use-budget";

const MATCH_MODE_LABELS: Record<KeywordMatchMode, string> = {
  contains: "Contains",
  startsWith: "Starts with",
  exact: "Exact match",
};

export interface DetailCategory {
  id: number;
  name: string;
  itemType: BudgetItemType;
  targetAmount: number | null;
  isActive: boolean;
  keywords: Keyword[];
  groupId?: number;
}

/**
 * Per-category detail editor: rename, expense/goal + target, keywords,
 * move-to (Category Group), archive/restore, delete. Structure mutations
 * save immediately with a toast.
 */
export function CategoryDetailDialog({
  category,
  open,
  onOpenChange,
}: {
  category: DetailCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const hierarchy = useBudgetHierarchy(true);
  const [name, setName] = useState("");
  const [isGoal, setIsGoal] = useState(false);
  const [target, setTarget] = useState("");
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keywordMode, setKeywordMode] = useState<KeywordMatchMode>("contains");
  const [groupId, setGroupId] = useState<number | undefined>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const keywordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!category) return;
    setEditingName(false);
    setName(category.name);
    setIsGoal(category.itemType === "goal");
    setTarget(category.targetAmount != null ? String(category.targetAmount) : "");
    setKeywords(category.keywords ?? []);
    const current = hierarchy?.subcategories.find((s) => s.id === category.id);
    setGroupId(current?.groupId ?? category.groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category?.id, hierarchy]);

  // keyword (lowercased) → name of the other category that already uses it.
  const conflicts = useMemo(() => {
    const m = new Map<string, string>();
    if (!hierarchy || !category) return m;
    for (const sub of hierarchy.subcategories) {
      if (sub.id === category.id || !sub.isActive) continue;
      for (const kw of sub.keywords ?? []) m.set(kw.text.toLowerCase(), sub.name);
    }
    return m;
  }, [hierarchy, category]);

  if (!category) return null;

  const isDuplicate =
    keywordInput.trim() !== "" &&
    keywords.some((k) => k.text.toLowerCase() === keywordInput.trim().toLowerCase());

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (!kw || keywords.some((k) => k.text.toLowerCase() === kw.toLowerCase())) return;
    setKeywords([...keywords, { text: kw, mode: keywordMode }]);
    setKeywordInput("");
    setKeywordMode("contains");
  };

  const setKeywordAt = (index: number, updates: Partial<Keyword>) => {
    setKeywords(keywords.map((k, i) => (i === index ? { ...k, ...updates } : k)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Don't lose a keyword that was typed but never tokenized with Enter.
      const typed = keywordInput.trim();
      const finalKeywords =
        typed && !keywords.some((k) => k.text.toLowerCase() === typed.toLowerCase())
          ? [...keywords, { text: typed, mode: keywordMode }]
          : keywords;
      await updateSubcategory(category.id, {
        name: name.trim() || category.name,
        itemType: isGoal ? "goal" : "expense",
        targetAmount: isGoal && target ? parseFloat(target) : null,
        keywords: finalKeywords,
        groupId,
      });
      toast.success("Category updated");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update category");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    try {
      if (category.isActive) {
        await archiveSubcategory(category.id);
        toast.success("Category archived");
      } else {
        await restoreSubcategory(category.id);
        toast.success("Category restored");
      }
      onOpenChange(false);
    } catch {
      toast.error("Failed to update category");
    }
  };

  const handleDelete = async () => {
    try {
      const res = await deleteSubcategory(category.id);
      toast.success(
        res.transactions > 0
          ? `Category deleted · ${res.transactions} transaction(s) uncategorized`
          : "Category deleted"
      );
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete category");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-5 sm:max-w-[680px]">
          <DialogHeader className="space-y-0">
            <DialogTitle className="sr-only">{name}</DialogTitle>
            <div className="flex items-start gap-2">
              <div className="flex max-w-[40%] shrink-0 flex-col gap-0.5">
                <Select value={groupId ? String(groupId) : ""} onValueChange={(v) => setGroupId(parseInt(v, 10))}>
                  <SelectTrigger className="h-9 w-auto gap-1 border-none bg-transparent p-0 text-2xl font-semibold shadow-none hover:opacity-80">
                    <SelectValue placeholder="Group" />
                  </SelectTrigger>
                  <SelectContent>
                    {hierarchy?.groups.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">Group</span>
              </div>
              <span className="flex h-9 select-none items-center text-2xl font-normal text-muted-foreground">/</span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex min-h-9 items-center gap-2 text-2xl font-semibold">
                  {editingName ? (
                    <input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => setEditingName(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setEditingName(false);
                        }
                      }}
                      className="w-full min-w-0 flex-1 bg-transparent text-2xl font-semibold outline-none"
                      aria-label="Category name"
                    />
                  ) : (
                    <>
                      <span className="truncate">{name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground"
                        onClick={() => setEditingName(true)}
                        aria-label="Rename category"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">Category</span>
              </div>
            </div>
            <DialogDescription className="sr-only">
              Edit this category&apos;s name, group, keywords, and savings goal.
            </DialogDescription>
          </DialogHeader>

          <div className="-mr-2 flex-1 space-y-5 overflow-y-auto overflow-x-hidden pr-2">
            <div className="space-y-1.5">
              <Label htmlFor="category-keywords">Keywords</Label>
              <p className="text-xs text-muted-foreground">
                Transactions matching a keyword are sorted into this category automatically.
              </p>
              <TooltipProvider delayDuration={200}>
                <div className="flex max-h-56 min-h-32 w-full flex-wrap content-start items-start gap-1.5 overflow-y-auto rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-sm">
                  {keywords.length === 0 && (
                    <span className="py-0.5 text-muted-foreground">No keywords yet</span>
                  )}
                  {keywords.map((kw, index) => {
                    const conflictWith = conflicts.get(kw.text.toLowerCase());
                    const tag = (
                      <Badge
                        key={`${kw.text}-${index}`}
                        variant="secondary"
                        className={cn(
                          "cursor-default gap-1 pl-1",
                          conflictWith &&
                            "border-amber-500/60 bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400"
                        )}
                      >
                        {conflictWith && <TriangleAlert className="h-3 w-3" />}
                        <select
                          value={kw.mode}
                          onChange={(e) => setKeywordAt(index, { mode: e.target.value as KeywordMatchMode })}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Match mode for ${kw.text}`}
                          className="cursor-pointer rounded bg-transparent text-[10px] uppercase tracking-wide text-muted-foreground outline-none"
                        >
                          {(Object.keys(MATCH_MODE_LABELS) as KeywordMatchMode[]).map((m) => (
                            <option key={m} value={m}>
                              {MATCH_MODE_LABELS[m]}
                            </option>
                          ))}
                        </select>
                        {kw.text}
                        <button
                          type="button"
                          className="cursor-pointer"
                          onClick={() => setKeywords(keywords.filter((_, i) => i !== index))}
                          aria-label={`Remove keyword ${kw.text}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                    return conflictWith ? (
                      <Tooltip key={`${kw.text}-${index}`}>
                        <TooltipTrigger asChild>{tag}</TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px]">
                          This overrides “{kw.text}” in your {conflictWith} category.
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      tag
                    );
                  })}
                </div>
              </TooltipProvider>
              <div className="flex gap-2 pt-1">
                <Select value={keywordMode} onValueChange={(v) => setKeywordMode(v as KeywordMatchMode)}>
                  <SelectTrigger size="sm" className="w-36 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MATCH_MODE_LABELS) as KeywordMatchMode[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        {MATCH_MODE_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  ref={keywordInputRef}
                  id="category-keywords"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!isDuplicate) addKeyword();
                    }
                  }}
                  placeholder="Add another keyword…"
                  aria-invalid={isDuplicate}
                  className={cn(
                    "flex-1",
                    isDuplicate && "border-destructive focus-visible:ring-destructive/40"
                  )}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 gap-1.5"
                  disabled={!keywordInput.trim() || isDuplicate}
                  onClick={() => {
                    addKeyword();
                    keywordInputRef.current?.focus();
                  }}
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              {isDuplicate && (
                <p className="text-xs font-medium text-destructive">
                  “{keywordInput.trim()}” is already a keyword on this category.
                </p>
              )}
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Savings goal</p>
                  <p className="text-xs text-muted-foreground">
                    Turn this category into a goal on your Goals page, and set an amount to save toward.
                  </p>
                </div>
                <Switch checked={isGoal} onCheckedChange={setIsGoal} />
              </div>

              {isGoal && (
                <div className="mt-4 space-y-1.5">
                  <Label htmlFor="category-target">Goal amount</Label>
                  <p className="text-xs text-muted-foreground">
                    Everything assigned to this category counts toward this total on your Goals page.
                  </p>
                  <div className="relative w-44">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                    <CurrencyInput
                      id="category-target"
                      value={target}
                      onChange={setTarget}
                      placeholder="0.00"
                      className="pl-5 text-right tabular-nums"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-row items-center gap-2 border-t pt-4 sm:justify-between">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={handleArchiveToggle}
              >
                {category.isActive ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                {category.isActive ? "Archive" : "Restore"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${category.name}"?`}
        description="This permanently deletes the category and its planned amounts. Assigned transactions become uncategorized. To keep history, archive it instead."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
