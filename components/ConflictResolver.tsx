"use client";

import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useVirtualScroll } from "@/components/resolve-step/VirtualScrollContext";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Transaction } from "@/lib/types";
import { DbCategory } from "@/lib/db";
import { DateCell, DescriptionCell, AmountCell } from "@/components/resolve-step";

const ROW_HEIGHT = 41;

interface ConflictResolverProps {
  conflictTransactions: Transaction[];
  categories: DbCategory[];
  onResolve: (transactionId: string, categoryId: string) => void;
  onRemoveKeyword: (categoryId: string, keyword: string) => void;
  onEditKeyword: (categoryId: string, oldKeyword: string, newKeyword: string) => void;
}

export function ConflictResolver({
  conflictTransactions,
  categories,
  onResolve,
  onRemoveKeyword,
  onEditKeyword,
}: ConflictResolverProps) {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const outerScrollRef = useVirtualScroll();

  useLayoutEffect(() => {
    const container = containerRef.current;
    const outerScroll = outerScrollRef?.current;
    if (!container || !outerScroll) return;
    const outerRect = outerScroll.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setScrollMargin(Math.max(0, containerRect.top - outerRect.top + outerScroll.scrollTop));
  });

  // Re-measure when the scroll container resizes (e.g. tab animation completes on first open)
  useEffect(() => {
    const outerScroll = outerScrollRef?.current;
    const container = containerRef.current;
    if (!outerScroll || !container) return;
    const observer = new ResizeObserver(() => {
      const outerRect = outerScroll.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setScrollMargin(Math.max(0, containerRect.top - outerRect.top + outerScroll.scrollTop));
    });
    observer.observe(outerScroll);
    return () => observer.disconnect();
  }, [outerScrollRef]);

  const virtualizer = useVirtualizer({
    count: conflictTransactions.length,
    getScrollElement: () => outerScrollRef?.current ?? null,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
    scrollMargin,
  });
  // Pending edits: "categoryId:keyword" -> new value
  const [pendingValues, setPendingValues] = useState<Map<string, string>>(new Map());
  // Pending removals: set of "categoryId:keyword"
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set());

  const getConflictingCategories = (transaction: Transaction): DbCategory[] => {
    if (!transaction.conflictingCategories) return [];
    return categories.filter((cat) =>
      transaction.conflictingCategories?.includes(cat.uuid)
    );
  };

  const getResolvedCategory = (transaction: Transaction): DbCategory | undefined => {
    if (!transaction.categoryId) return undefined;
    return categories.find(c => c.uuid === transaction.categoryId);
  };

  const getMatchingKeywords = (transaction: Transaction, category: DbCategory): string[] => {
    const lowerText = transaction.matchField.toLowerCase();
    return category.keywords.filter(k => lowerText.includes(k.toLowerCase()));
  };

  const makeKey = (categoryId: string, keyword: string) => `${categoryId}:${keyword}`;

  const getPendingValue = (categoryId: string, keyword: string) =>
    pendingValues.get(makeKey(categoryId, keyword)) ?? keyword;

  const setPendingValue = (categoryId: string, keyword: string, value: string) =>
    setPendingValues(prev => new Map(prev).set(makeKey(categoryId, keyword), value));

  const stageRemoval = (categoryId: string, keyword: string) =>
    setPendingRemovals(prev => new Set(prev).add(makeKey(categoryId, keyword)));

  const unstageRemoval = (categoryId: string, keyword: string) =>
    setPendingRemovals(prev => { const next = new Set(prev); next.delete(makeKey(categoryId, keyword)); return next; });

  const isStaged = (categoryId: string, keyword: string) =>
    pendingRemovals.has(makeKey(categoryId, keyword));

  const handleSave = () => {
    // Apply removals
    for (const key of pendingRemovals) {
      const [categoryId, ...kwParts] = key.split(":");
      onRemoveKeyword(categoryId, kwParts.join(":"));
    }
    // Apply edits (skip keywords staged for removal)
    for (const [key, newValue] of pendingValues) {
      if (pendingRemovals.has(key)) continue;
      const [categoryId, ...kwParts] = key.split(":");
      const oldKeyword = kwParts.join(":");
      if (newValue.trim() && newValue.trim() !== oldKeyword) {
        onEditKeyword(categoryId, oldKeyword, newValue.trim());
      }
    }
    handleCloseDialog();
  };

  const handleCloseDialog = () => {
    setEditingTransaction(null);
    setPendingValues(new Map());
    setPendingRemovals(new Set());
  };

  if (conflictTransactions.length === 0) {
    return null;
  }

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start - scrollMargin : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end + scrollMargin
      : 0;

  return (
    <>
      <div ref={containerRef}>
        <table className="w-full caption-bottom text-sm" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 120 }} />
            <col />
            <col style={{ width: 100 }} />
            <col style={{ width: 220 }} />
          </colgroup>
          <thead className="border-b">
            <tr>
              <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground pl-6">Date</th>
              <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Description</th>
              <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Amount</th>
              <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground pr-6">Status</th>
            </tr>
          </thead>
          <tbody>
            {paddingTop > 0 && <tr><td colSpan={4} style={{ height: paddingTop }} /></tr>}
            {virtualItems.map((vItem) => {
              const transaction = conflictTransactions[vItem.index];
              const conflicting = getConflictingCategories(transaction);
              const resolvedCategory = getResolvedCategory(transaction);
              const isResolved = !!resolvedCategory;
              return (
                <tr key={vItem.key} className="border-b transition-colors hover:bg-muted/50">
                  <DateCell date={transaction.date} />
                  <DescriptionCell description={transaction.description} />
                  <AmountCell amountOut={transaction.amountOut} amountIn={transaction.amountIn} />
                  <td className="p-2 text-right pr-6">
                    <div className="flex justify-end items-center gap-1.5">
                      <Select
                        value={isResolved ? resolvedCategory.uuid : undefined}
                        onValueChange={(value) => onResolve(transaction.id, value)}
                      >
                        <SelectTrigger className="w-[130px] h-7 text-xs">
                          <SelectValue placeholder="Pick category" />
                        </SelectTrigger>
                        <SelectContent>
                          {conflicting.map((cat) => (
                            <SelectItem key={cat.uuid} value={cat.uuid} className="text-xs">
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingTransaction(transaction)}
                        title="Edit conflicting keywords"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {paddingBottom > 0 && <tr><td colSpan={4} style={{ height: paddingBottom }} /></tr>}
          </tbody>
        </table>
      </div>

      {/* Edit Keywords Dialog */}
      <Dialog open={editingTransaction !== null} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle>Edit Conflicting Keywords</DialogTitle>
            <DialogDescription>
              Remove or rename a keyword to resolve the conflict automatically.
            </DialogDescription>
          </DialogHeader>

          {editingTransaction && (
            <div className="space-y-4 min-w-0">
              {/* Transaction description */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Transaction</p>
                <p
                  className="text-sm bg-muted px-3 py-2 rounded font-mono truncate"
                  title={editingTransaction.description}
                >
                  {editingTransaction.description}
                </p>
              </div>

              {/* Conflicting categories */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Conflicting categories</p>
                {getConflictingCategories(editingTransaction).map((cat) => {
                  const matchingKws = getMatchingKeywords(editingTransaction, cat);
                  return (
                    <div key={cat.uuid} className="border rounded-lg p-3 space-y-2 min-w-0">
                      <p className="font-medium text-sm truncate" title={cat.name}>{cat.name}</p>
                      {matchingKws.map((kw) => {
                        const staged = isStaged(cat.uuid, kw);
                        return (
                          <div key={kw} className="flex items-center gap-2 min-w-0">
                            <Input
                              value={getPendingValue(cat.uuid, kw)}
                              onChange={(e) => setPendingValue(cat.uuid, kw, e.target.value)}
                              className={`h-7 text-xs font-mono flex-1 min-w-0 ${staged ? "line-through opacity-40" : ""}`}
                              disabled={staged}
                            />
                            {staged ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs shrink-0"
                                onClick={() => unstageRemoval(cat.uuid, kw)}
                              >
                                Undo
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => stageRemoval(cat.uuid, kw)}
                                title="Remove keyword"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
