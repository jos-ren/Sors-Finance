"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { syncDataLoaderFeature, hotkeysCoreFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { Tree, TreeItem } from "@/components/reui/tree";
import { cn } from "@/lib/utils";
import type { BudgetTree, BudgetTreeGroup, BudgetTreeSubcategory, BudgetTreeItem } from "@/lib/budget/types";
import { BudgetItemRow } from "./budget-item-row";
import { useBudgetTreeInputs } from "./budget-tree-context";

const INDENT = 22;
const EXPAND_KEY = "sors:budget:tree-expanded";

type NodeKind = "root" | "group" | "sub" | "item";
interface TNode {
  name: string;
  kind: NodeKind;
  children?: string[];
}

interface BudgetTreeViewProps {
  tree: BudgetTree;
  pending: Map<number, string>;
  formatAmount: (n: number) => string;
  year: number;
  month: number;
  onPlannedChange: (itemId: number, value: string) => void;
  onPlannedCommit: () => void;
  onOpenDetail: (item: BudgetTreeItem) => void;
}

/**
 * Collapsible 3-level budget tree built on the reui/headless-tree component:
 * expand/collapse + keyboard nav at every level, indentation guide lines, and
 * inline planned-amount editing on the leaf rows. Remounts (via a structure
 * key) only when the hierarchy shape changes, so editing amounts keeps focus.
 */
export function BudgetTreeView(props: BudgetTreeViewProps) {
  const structureKey = useMemo(
    () =>
      props.tree.groups
        .map((g) => `${g.id}:${g.subcategories.map((s) => `${s.id}[${s.items.map((i) => i.id).join(",")}]`).join("|")}`)
        .join(";"),
    [props.tree]
  );
  return <HeadlessBudgetTree key={structureKey} {...props} />;
}

function HeadlessBudgetTree({
  tree: budget,
  pending,
  formatAmount,
  year,
  month,
  onPlannedChange,
  onPlannedCommit,
  onOpenDetail,
}: BudgetTreeViewProps) {
  // Build the headless-tree node map + per-node lookups into the effective tree.
  const { nodes, allFolderIds, groupByNode, subByNode, itemByNode } = useMemo(() => {
    const nodes: Record<string, TNode> = {
      root: { name: "root", kind: "root", children: budget.groups.map((g) => `group:${g.id}`) },
    };
    const groupByNode: Record<string, BudgetTreeGroup> = {};
    const subByNode: Record<string, BudgetTreeSubcategory> = {};
    const itemByNode: Record<string, BudgetTreeItem> = {};
    const allFolderIds: string[] = [];

    for (const g of budget.groups) {
      const gid = `group:${g.id}`;
      groupByNode[gid] = g;
      allFolderIds.push(gid);
      nodes[gid] = { name: g.name, kind: "group", children: g.subcategories.map((s) => `sub:${s.id}`) };
      for (const s of g.subcategories) {
        const sid = `sub:${s.id}`;
        subByNode[sid] = s;
        allFolderIds.push(sid);
        nodes[sid] = { name: s.name, kind: "sub", children: s.items.map((i) => `item:${i.id}`) };
        for (const it of s.items) {
          const iid = `item:${it.id}`;
          itemByNode[iid] = it;
          nodes[iid] = { name: it.name, kind: "item" };
        }
      }
    }
    return { nodes, allFolderIds, groupByNode, subByNode, itemByNode };
  }, [budget]);

  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(EXPAND_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return allFolderIds; // default: everything expanded so all three tiers are visible
  });

  const applyExpanded = useCallback((updater: string[] | ((prev: string[]) => string[])) => {
    setExpandedItems((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        localStorage.setItem(EXPAND_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Register planned-input focus order (all item ids in tree order) so Enter
  // advances to the next mounted input; collapsed/unmounted inputs are skipped.
  const { setOrder } = useBudgetTreeInputs();
  const orderedItemIds = useMemo(
    () => budget.groups.flatMap((g) => g.subcategories.flatMap((s) => s.items.map((i) => i.id))),
    [budget]
  );
  useEffect(() => {
    setOrder(orderedItemIds);
  }, [orderedItemIds, setOrder]);

  const tree = useTree<TNode>({
    state: { expandedItems },
    setExpandedItems: applyExpanded,
    rootItemId: "root",
    getItemName: (item) => item.getItemData()?.name ?? "",
    isItemFolder: (item) => {
      const kind = item.getItemData()?.kind;
      return kind === "root" || kind === "group" || kind === "sub";
    },
    dataLoader: {
      getItem: (id) => nodes[id],
      getChildren: (id) => nodes[id]?.children ?? [],
    },
    indent: INDENT,
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  const drillHref = (itemId: number) => `/budget/item/${itemId}?year=${year}&month=${month}`;

  return (
    <Tree indent={INDENT} tree={tree} className="rounded-lg border bg-card p-1">
      {tree.getItems().map((item) => {
        const id = item.getId();
        if (id === "root") return null;
        const node = nodes[id];
        if (!node) return null;
        const depth = Math.max(0, item.getItemMeta().level - 1); // groups flush-left

        // Depth guide columns (continuous vertical rails between rows).
        const guides = Array.from({ length: depth }, (_, i) => (
          <span key={i} className="w-[22px] shrink-0 border-l border-border/40" aria-hidden />
        ));

        if (node.kind === "group") {
          const g = groupByNode[id];
          return (
            <TreeItem key={id} item={item} render={<div />} className="!ps-0">
              <div className="flex items-stretch">
                {guides}
                <div className="flex flex-1 cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-accent/40">
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !item.isExpanded() && "-rotate-90")} />
                  <span className="font-semibold">{g.name}</span>
                  <span className="flex-1" />
                  <span className="text-sm font-medium tabular-nums">{formatAmount(g.planned)}</span>
                  <span className="w-24 text-right text-sm tabular-nums text-muted-foreground">{formatAmount(g.actual)}</span>
                </div>
              </div>
            </TreeItem>
          );
        }

        if (node.kind === "sub") {
          const s = subByNode[id];
          return (
            <TreeItem key={id} item={item} render={<div />} className="!ps-0">
              <div className="flex items-stretch">
                {guides}
                <div className="flex flex-1 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/40">
                  <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !item.isExpanded() && "-rotate-90")} />
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.name}</span>
                  <span className="flex-1" />
                  <span className="text-xs tabular-nums text-muted-foreground">{formatAmount(s.planned)}</span>
                </div>
              </div>
            </TreeItem>
          );
        }

        // Leaf item — reuse BudgetItemRow; stop propagation so typing/clicks
        // don't reach the tree's keyboard/primary-action handlers.
        const it = itemByNode[id];
        return (
          <TreeItem key={id} item={item} render={<div />} className="!ps-0">
            <div className="flex items-stretch">
              {guides}
              <div
                className="min-w-0 flex-1"
                onKeyDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <BudgetItemRow
                  item={it}
                  pendingValue={pending.get(it.id)}
                  dirty={pending.has(it.id)}
                  formatAmount={formatAmount}
                  drillHref={drillHref(it.id)}
                  onPlannedChange={(v) => onPlannedChange(it.id, v)}
                  onPlannedCommit={onPlannedCommit}
                  onOpenDetail={() => onOpenDetail(it)}
                />
              </div>
            </div>
          </TreeItem>
        );
      })}
    </Tree>
  );
}
