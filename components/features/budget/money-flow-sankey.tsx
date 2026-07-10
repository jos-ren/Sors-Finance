"use client";

import { useMemo } from "react";
import { ResponsiveContainer, Sankey, Layer, Rectangle, Tooltip } from "recharts";
import type { BudgetTree } from "@/lib/budget/types";

// Same fixed categorical palette used for per-category identity elsewhere in
// the app (see PIE_COLORS in app/(main)/page.tsx) — reused here rather than
// inventing a new one, and assigned in the same fixed left-to-right order.
const CATEGORY_COLORS = [
  "var(--alt-blue)",
  "var(--alt-orange)",
  "var(--alt-emerald)",
  "var(--alt-fuchsia)",
  "var(--alt-cyan)",
  "var(--alt-amber)",
  "var(--alt-indigo)",
  "var(--alt-lime)",
  "var(--alt-pink)",
  "var(--alt-green)",
];
const INCOME_COLOR = "var(--primary)";
const UNSPENT_COLOR = "var(--muted-foreground)";

interface FlowNode {
  name: string;
  color: string;
  // Named `value` (not `amount`) because recharts' Sankey tooltip payload
  // reads a node's amount via the `value` dataKey by convention.
  value: number;
}
interface FlowLink {
  source: number;
  target: number;
  value: number;
}

function buildMoneyFlow(
  tree: BudgetTree
): { nodes: FlowNode[]; links: FlowLink[]; maxDepth: number; maxColumnCount: number } | null {
  const { incomeActual } = tree.summary;
  const nodes: FlowNode[] = [];
  const links: FlowLink[] = [];
  let maxDepth = 0;
  // Nodes per column (depth 0 = Income), so the chart can grow tall enough
  // that no column's rows get squeezed thin enough to clip their labels.
  const depthCounts: number[] = [1];

  const incomeIdx = nodes.push({ name: "Income", color: INCOME_COLOR, value: incomeActual }) - 1;

  const totalGroupActual = tree.groups.reduce((sum, g) => sum + (g.actual > 0 ? g.actual : 0), 0);
  const unspent = incomeActual - totalGroupActual;

  // Depth-1 nodes (groups + Unspent) are ranked together by amount, then
  // each group's categories are ranked among themselves — so, with
  // `sort={false}` on <Sankey> below, recharts lays everything out in this
  // exact order instead of re-ranking nodes by amount across the whole
  // column, which would otherwise pull a small category up above a larger
  // group's rows (or Unspent below a smaller group).
  //
  // Each group (and all of its categories) shares one color from the
  // palette, assigned by group identity rather than by rank, so a group's
  // color doesn't shift around as amounts change period to period.
  const topLevel: Array<{ name: string; color: string; value: number; categories?: BudgetTree["groups"][number]["categories"] }> =
    tree.groups
      .filter((g) => g.actual > 0)
      .map((g, i) => ({ name: g.name, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length], value: g.actual, categories: g.categories }));
  if (unspent > 0.005) {
    topLevel.push({ name: "Unspent", color: UNSPENT_COLOR, value: unspent });
  }
  topLevel.sort((a, b) => b.value - a.value);

  for (const item of topLevel) {
    // Groupless items (Unspent) have no real second hop, but recharts
    // forces any node with no outgoing links into the rightmost column —
    // which would otherwise strand Unspent one column ahead of where its
    // Income link visually starts, and throw off the per-column row count
    // used for sizing. Route it through an unlabeled same-value
    // pass-through node so it lands in the categories column like every
    // other leaf, with its name/amount label on the actual rightmost node.
    const { categories } = item;
    const itemIdx = nodes.push({ name: categories ? item.name : "", color: item.color, value: item.value }) - 1;
    links.push({ source: incomeIdx, target: itemIdx, value: item.value });
    maxDepth = Math.max(maxDepth, 1);
    depthCounts[1] = (depthCounts[1] ?? 0) + 1;

    if (!categories) {
      const passThroughIdx = nodes.push({ name: item.name, color: item.color, value: item.value }) - 1;
      links.push({ source: itemIdx, target: passThroughIdx, value: item.value });
      maxDepth = Math.max(maxDepth, 2);
      depthCounts[2] = (depthCounts[2] ?? 0) + 1;
      continue;
    }
    const sortedCategories = [...categories].filter((c) => c.actual > 0).sort((a, b) => b.actual - a.actual);
    for (const c of sortedCategories) {
      const catIdx = nodes.push({ name: c.name, color: item.color, value: c.actual }) - 1;
      links.push({ source: itemIdx, target: catIdx, value: c.actual });
      maxDepth = Math.max(maxDepth, 2);
      depthCounts[2] = (depthCounts[2] ?? 0) + 1;
    }
  }

  if (links.length === 0) return null;
  const maxColumnCount = Math.max(...depthCounts);
  return { nodes, links, maxDepth, maxColumnCount };
}

function SankeyNode({
  x,
  y,
  width,
  height,
  payload,
  maxDepth,
  formatAmountShort,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: FlowNode & { depth: number };
  maxDepth: number;
  formatAmountShort: (n: number) => string;
}) {
  const isLastColumn = payload.depth === maxDepth;
  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill={payload.color} fillOpacity={0.85} />
      <text
        x={isLastColumn ? x - 6 : x + width + 6}
        y={y + height / 2}
        textAnchor={isLastColumn ? "end" : "start"}
        dominantBaseline="middle"
        className="fill-foreground text-[12px]"
      >
        {payload.name}
      </text>
      <text
        x={isLastColumn ? x - 6 : x + width + 6}
        y={y + height / 2 + 14}
        textAnchor={isLastColumn ? "end" : "start"}
        dominantBaseline="middle"
        className="fill-muted-foreground text-[11px] tabular-nums"
      >
        {formatAmountShort(payload.value)}
      </text>
    </Layer>
  );
}

function SankeyLinkPath(props: {
  sourceX: number;
  sourceY: number;
  sourceControlX: number;
  targetX: number;
  targetY: number;
  targetControlX: number;
  linkWidth: number;
  payload: { target: FlowNode };
}) {
  const { sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, payload } = props;
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={payload.target.color}
      strokeOpacity={0.25}
      strokeWidth={linkWidth}
    />
  );
}

function FlowTooltip({
  active,
  payload,
  formatAmountShort,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
  formatAmountShort: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  // recharts labels link hovers "Source - Target"; render as an arrow instead.
  const label = name?.includes(" - ") ? name.replace(" - ", " → ") : name;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <div className="font-medium">{label}</div>
      <div className="tabular-nums text-muted-foreground">{formatAmountShort(value ?? 0)}</div>
    </div>
  );
}

/**
 * Income → Category Group → Category money-flow diagram for the current
 * period, using actual spending (not planned amounts) so it shows where
 * money really went. Renders nothing if there's no income/spending yet.
 */
export function MoneyFlowSankey({
  tree,
  formatAmountShort,
}: {
  tree: BudgetTree;
  formatAmountShort: (n: number) => string;
}) {
  const flow = useMemo(() => buildMoneyFlow(tree), [tree]);

  if (!flow) return null;
  const { maxDepth, maxColumnCount, ...data } = flow;
  // Each row needs room for the two-line label (name + amount) plus
  // nodePadding between rows — without this, a busy column (many groups or
  // categories) squeezes rows thin enough that the bottom-most node's amount
  // label spills past the chart's bottom edge and gets clipped.
  const height = Math.max(360, maxColumnCount * 40 + 20);

  return (
    <div className="rounded-xl border bg-card p-4">
      <ResponsiveContainer width="100%" height={height}>
        <Sankey
          data={data}
          nodeWidth={12}
          nodePadding={20}
          linkCurvature={0.5}
          sort={false}
          margin={{ top: 8, right: 120, bottom: 16, left: 80 }}
          node={(props) => <SankeyNode {...(props as any)} maxDepth={maxDepth} formatAmountShort={formatAmountShort} />}
          link={(props) => <SankeyLinkPath {...(props as any)} />}
        >
          <Tooltip content={(props) => <FlowTooltip {...(props as any)} formatAmountShort={formatAmountShort} />} />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}
