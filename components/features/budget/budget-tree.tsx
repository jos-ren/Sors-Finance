"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BudgetTree, BudgetTreeItem } from "@/lib/budget/types";
import { BudgetItemRow } from "./budget-item-row";
import { useBudgetTreeInputs } from "./budget-tree-context";

const COLLAPSE_KEY = "sors:budget:collapsed-groups";

function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (raw) setCollapsed(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, []);
  const toggle = useCallback((uuid: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return { collapsed, toggle };
}

export function BudgetTreeView({
  tree,
  pending,
  formatAmount,
  year,
  month,
  onPlannedChange,
  onPlannedCommit,
  onOpenDetail,
}: {
  tree: BudgetTree;
  pending: Map<number, string>;
  formatAmount: (n: number) => string;
  year: number;
  month: number;
  onPlannedChange: (itemId: number, value: string) => void;
  onPlannedCommit: () => void;
  onOpenDetail: (item: BudgetTreeItem) => void;
}) {
  const { collapsed, toggle } = useCollapsedGroups();
  const { setOrder } = useBudgetTreeInputs();

  // Register the visual order of item inputs so Enter can advance focus.
  useEffect(() => {
    const ids: number[] = [];
    for (const g of tree.groups) {
      if (collapsed.has(g.uuid)) continue;
      for (const s of g.subcategories) for (const it of s.items) ids.push(it.id);
    }
    setOrder(ids);
  }, [tree, collapsed, setOrder]);

  const drillHref = (itemId: number) => `/budget/item/${itemId}?year=${year}&month=${month}`;

  return (
    <div className="space-y-3">
      {tree.groups.map((group) => {
        const isCollapsed = collapsed.has(group.uuid);
        return (
          <div key={group.id} className="overflow-hidden rounded-lg border bg-card">
            <button
              onClick={() => toggle(group.uuid)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-accent/40"
            >
              <span className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")} />
                <span className="font-semibold">{group.name}</span>
              </span>
              <span className="flex items-center gap-3 text-sm tabular-nums">
                <span className="font-medium">{formatAmount(group.planned)}</span>
                <span className="text-muted-foreground">{formatAmount(group.actual)}</span>
              </span>
            </button>

            {!isCollapsed && (
              <div className="border-t">
                {group.subcategories.map((sub) => {
                  const singleItem = sub.items.length === 1;
                  return (
                    <div key={sub.id} className="border-b last:border-b-0">
                      {!singleItem && (
                        <div className="flex items-center justify-between px-3 pt-2 pb-1">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {sub.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {formatAmount(sub.planned)}
                          </span>
                        </div>
                      )}
                      <div className="divide-y divide-border/50 px-1 pb-1">
                        {sub.items.map((item) => (
                          <BudgetItemRow
                            key={item.id}
                            item={item}
                            pendingValue={pending.get(item.id)}
                            dirty={pending.has(item.id)}
                            formatAmount={formatAmount}
                            drillHref={drillHref(item.id)}
                            onPlannedChange={(v) => onPlannedChange(item.id, v)}
                            onPlannedCommit={onPlannedCommit}
                            onOpenDetail={() => onOpenDetail(item)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
