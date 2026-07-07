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
const GROUP_COLOR = "var(--muted-foreground)";
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

  let categoryColorIndex = 0;
  let totalGroupActual = 0;
  for (const g of tree.groups) {
    if (g.actual <= 0) continue;
    totalGroupActual += g.actual;
    const groupIdx = nodes.push({ name: g.name, color: GROUP_COLOR, value: g.actual }) - 1;
    links.push({ source: incomeIdx, target: groupIdx, value: g.actual });
    maxDepth = Math.max(maxDepth, 1);
    depthCounts[1] = (depthCounts[1] ?? 0) + 1;

    for (const c of g.categories) {
      if (c.actual <= 0) continue;
      const color = CATEGORY_COLORS[categoryColorIndex % CATEGORY_COLORS.length];
      categoryColorIndex++;
      const catIdx = nodes.push({ name: c.name, color, value: c.actual }) - 1;
      links.push({ source: groupIdx, target: catIdx, value: c.actual });
      maxDepth = Math.max(maxDepth, 2);
      depthCounts[2] = (depthCounts[2] ?? 0) + 1;
    }
  }

  const unspent = incomeActual - totalGroupActual;
  if (unspent > 0.005) {
    const unspentIdx = nodes.push({ name: "Unspent", color: UNSPENT_COLOR, value: unspent }) - 1;
    links.push({ source: incomeIdx, target: unspentIdx, value: unspent });
    maxDepth = Math.max(maxDepth, 1);
    depthCounts[1] = (depthCounts[1] ?? 0) + 1;
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
