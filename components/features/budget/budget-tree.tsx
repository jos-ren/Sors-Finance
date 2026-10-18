"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { syncDataLoaderFeature, hotkeysCoreFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { Tree, TreeItem } from "@/components/reui/tree";
import { cn } from "@/lib/utils";
import type { BudgetTree, BudgetTreeGroup, BudgetTreeCategory } from "@/lib/budget/types";
import { BudgetItemRow } from "./budget-item-row";
import { SpentOverPlanned } from "./spent-over-planned";
import { useBudgetTreeInputs } from "./budget-tree-context";

const INDENT = 22;
const EXPAND_KEY = "sors:budget:tree-expanded";

type NodeKind = "root" | "group" | "category";
interface TNode {
  name: string;
  kind: NodeKind;
  children?: string[];
}

interface BudgetTreeViewProps {
  tree: BudgetTree;
  formatAmountShort: (n: number) => string;
  year: number;
  month: number;
  onOpenDetail: (category: BudgetTreeCategory) => void;
}

/**
 * Collapsible budget tree (Category Group → Category) built on the
 * reui/headless-tree component: expand/collapse + keyboard nav, indentation
 * guide lines. Planned amounts are read-only here — set them in the Builder.
 * A category's transactions live on its own page (click the category).
 * Remounts (via a structure key) only when the hierarchy shape changes.
 */
export function BudgetTreeView(props: BudgetTreeViewProps) {
  const structureKey = useMemo(
    () => props.tree.groups.map((g) => `${g.id}:${g.categories.map((c) => c.id).join(",")}`).join(";"),
    [props.tree]
  );
  return <HeadlessBudgetTree key={structureKey} {...props} />;
}

function HeadlessBudgetTree({ tree: budget, formatAmountShort, year, month, onOpenDetail }: BudgetTreeViewProps) {
  // Build the headless-tree node map + per-node lookups into the effective tree.
  const { nodes, allFolderIds, groupByNode, categoryByNode } = useMemo(() => {
    const nodes: Record<string, TNode> = {
      root: { name: "root", kind: "root", children: budget.groups.map((g) => `group:${g.id}`) },
    };
    const groupByNode: Record<string, BudgetTreeGroup> = {};
    const categoryByNode: Record<string, BudgetTreeCategory> = {};
    const allFolderIds: string[] = [];

    for (const g of budget.groups) {
      const gid = `group:${g.id}`;
      groupByNode[gid] = g;
      allFolderIds.push(gid);
      nodes[gid] = { name: g.name, kind: "group", children: g.categories.map((c) => `category:${c.id}`) };
      for (const c of g.categories) {
        const cid = `category:${c.id}`;
        categoryByNode[cid] = c;
        nodes[cid] = { name: c.name, kind: "category" };
      }
    }
    return { nodes, allFolderIds, groupByNode, categoryByNode };
  }, [budget]);

  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(EXPAND_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return allFolderIds; // default: groups expanded
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

  // Register planned-input focus order (all category ids in tree order) so
  // Enter advances to the next mounted input; collapsed/unmounted inputs are skipped.
  const { setOrder } = useBudgetTreeInputs();
  const orderedCategoryIds = useMemo(
    () => budget.groups.flatMap((g) => g.categories.map((c) => c.id)),
    [budget]
  );
  useEffect(() => {
    setOrder(orderedCategoryIds);
  }, [orderedCategoryIds, setOrder]);

  const tree = useTree<TNode>({
    state: { expandedItems },
    setExpandedItems: applyExpanded,
    rootItemId: "root",
    getItemName: (item) => item.getItemData()?.name ?? "",
    isItemFolder: (item) => {
      const data = item.getItemData();
      if (!data) return false;
      return data.kind === "root" || data.kind === "group";
    },
    dataLoader: {
      getItem: (id) => nodes[id],
      getChildren: (id) => nodes[id]?.children ?? [],
    },
    indent: INDENT,
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  const drillHref = (categoryId: number) => `/budget/category/${categoryId}?year=${year}&month=${month}`;

  return (
    <Tree indent={INDENT} tree={tree} className="rounded-lg border bg-card p-1">
      {tree.getItems().map((item) => {
        const id = item.getId();
        if (id === "root") return null;
        const node = nodes[id];
        if (!node) return null;
        const depth = item.getItemMeta().level; // groups (level 0) flush-left

        // Depth guide columns (continuous vertical rails between rows), each
        // aligned under its ancestor row's chevron rather than the column edge.
        const guides = Array.from({ length: depth }, (_, i) => (
          <span key={i} className="relative w-[22px] shrink-0" aria-hidden>
            <span className="absolute -bottom-0.5 top-0 left-4 border-l-2 border-border/40 dark:border-border/60" />
          </span>
        ));

        if (node.kind === "group") {
          const g = groupByNode[id];
          const diff = g.actual - g.planned;
          const groupColor =
            Math.abs(diff) < 0.005 ? "text-orange-500" : diff < 0 ? "text-emerald-500" : "text-destructive";
          return (
            <TreeItem key={id} item={item} render={<div />} className="!ps-0">
              <div className="flex items-stretch">
                {guides}
                <div className="flex flex-1 cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-accent/40">
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !item.isExpanded() && "-rotate-90")} />
                  <span className="text-sm">{g.name}</span>
                  <span className="flex-1" />
                  <SpentOverPlanned
                    actual={g.actual}
                    planned={g.planned}
                    formatAmountShort={formatAmountShort}
                    className="text-sm text-muted-foreground"
                    actualClassName={groupColor}
                  />
                </div>
              </div>
            </TreeItem>
          );
        }

        // Leaf category — reuse BudgetItemRow; stop propagation so typing/clicks
        // don't reach the tree's keyboard/primary-action handlers.
        const c = categoryByNode[id];
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
                  item={c}
                  formatAmountShort={formatAmountShort}
                  drillHref={drillHref(c.id)}
                  onOpenDetail={() => onOpenDetail(c)}
                />
              </div>
            </div>
          </TreeItem>
        );
      })}
    </Tree>
  );
}
