"use client";

import { useMemo, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveContainer, Sankey, Layer, Rectangle, Tooltip } from "recharts";
import type { BudgetTree } from "@/lib/budget/types";
import { projectHatchFill, projectHatchPattern } from "@/components/features/projects/project-hatch";

// Pattern ids are document-global; this keeps the Sankey's from clashing with the Home charts'.
const SANKEY_HATCH_PREFIX = "sankey";

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
const SPENT_COLOR = "var(--primary)";
// Several projects share the Projects node: a neutral colour that no group can have.
const PROJECTS_COLOR = "var(--foreground)";
// Slate (a cool blue-grey), so Uncategorized stands apart from the group colours.
const UNCATEGORIZED_COLOR = "color-mix(in oklab, oklch(0.62 0.05 250) 80%, transparent)";

interface FlowNode {
  name: string;
  color: string;
  // Named `value` (not `amount`) because recharts' Sankey tooltip payload
  // reads a node's amount via the `value` dataKey by convention.
  value: number;
  /** Where clicking the node goes (a category's month page, a project); absent for non-drillable nodes. */
  href?: string;
  /** Project spending: drawn with the same diagonal hatch as the Home charts, in the project's colour. */
  hatch?: { projectId: number; color: string };
  /** The "Spent" node only: the month's income, shown in its tooltip as context (never drawn as a bar). */
  income?: { budgeted: number | null; received: number };
}
interface FlowLink {
  source: number;
  target: number;
  value: number;
}

function buildMoneyFlow(
  tree: BudgetTree,
  plannedIncome: number | null
): { nodes: FlowNode[]; links: FlowLink[]; maxDepth: number; maxColumnCount: number } | null {
  const nodes: FlowNode[] = [];
  const links: FlowLink[] = [];
  let maxDepth = 0;
  // Nodes per column (depth 0 = Spent), so the chart can grow tall enough
  // that no column's rows get squeezed thin enough to clip their labels.
  const depthCounts: number[] = [1];

  // Separately funded projects are not in group actuals; show them as their
  // own branch so the flow still accounts for that money.
  const projectTotals = new Map<number, { projectId: number; name: string; color: string; value: number; href: string }>();
  for (const g of tree.groups) {
    for (const c of g.categories) {
      for (const p of c.projectSpend) {
        const cur = projectTotals.get(p.projectId) ?? {
          projectId: p.projectId,
          name: p.name,
          color: p.color,
          value: 0,
          href: `/projects/${p.projectId}`,
        };
        cur.value += p.amount;
        projectTotals.set(p.projectId, cur);
      }
    }
  }
  const projectChildren = [...projectTotals.values()].filter((p) => p.value > 0);
  const totalProjects = projectChildren.reduce((sum, p) => sum + p.value, 0);
  const uncategorized = tree.summary.uncategorizedOut;

  // Depth-1 nodes (groups, Projects) are ranked together by amount, then
  // each group's categories are ranked among themselves — so, with
  // `sort={false}` on <Sankey> below, recharts lays everything out in this
  // exact order instead of re-ranking nodes by amount across the whole
  // column, which would otherwise pull a small category up above a larger
  // group's rows.
  //
  // Each group (and all of its categories) shares one color from the
  // palette, assigned by group identity rather than by rank, so a group's
  // color doesn't shift around as amounts change period to period.
  const topLevel: Array<{
    name: string;
    color: string;
    value: number;
    href?: string;
    hatch?: FlowNode["hatch"];
    children?: Array<{ name: string; value: number; href?: string; color?: string; hatch?: FlowNode["hatch"] }>;
  }> = tree.groups
    .filter((g) => g.actual > 0)
    .map((g, i) => ({
      name: g.name,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      value: g.actual,
      children: g.categories.map((c) => ({
        name: c.name,
        value: c.actual,
        href: `/budget/category/${c.id}?year=${tree.year}&month=${tree.month}`,
      })),
    }));
  if (totalProjects > 0.005) {
    // One project: the parent node and its link take that project's colour, so the
    // band is not mistaken for a group. Several: a neutral hatch (id 0 is no real project).
    const only = projectChildren.length === 1 ? projectChildren[0] : null;
    const parentColor = only?.color ?? PROJECTS_COLOR;
    topLevel.push({
      name: "Projects",
      color: parentColor,
      value: totalProjects,
      hatch: { projectId: only?.projectId ?? 0, color: parentColor },
      children: projectChildren.map((p) => ({
        name: p.name,
        value: p.value,
        href: p.href,
        color: p.color,
        hatch: { projectId: p.projectId, color: p.color },
      })),
    });
  }
  topLevel.sort((a, b) => b.value - a.value);
  // Uncategorized money out always sits last (bottom) so it stands apart from
  // the ranked groups: it is the part of the month still waiting for a category.
  if (uncategorized > 0.005) {
    topLevel.push({
      name: "Uncategorized",
      color: UNCATEGORIZED_COLOR,
      value: uncategorized,
      href: `/budget/uncategorized?year=${tree.year}&month=${tree.month}`,
    });
  }

  // The first node is simply everything that was spent, so every bar's height
  // is exactly its number. Income is context only: it lives in this node's tooltip.
  const totalSpent = topLevel.reduce((sum, item) => sum + item.value, 0);
  const budgeted = plannedIncome != null && plannedIncome > 0 ? plannedIncome : null;
  const spentIdx =
    nodes.push({
      name: "Spent",
      color: SPENT_COLOR,
      value: totalSpent,
      income: { budgeted, received: tree.summary.incomeActual },
    }) - 1;

  for (const item of topLevel) {
    // Groupless items (Uncategorized) have no real second hop, but recharts
    // forces any node with no outgoing links into the rightmost column —
    // which would otherwise strand it one column ahead of where its Spent
    // link visually starts, and throw off the per-column row count used for
    // sizing. Route it through an unlabeled same-value pass-through node so
    // it lands in the categories column like every other leaf, with its
    // name/amount label on the actual rightmost node.
    const { children } = item;
    const itemIdx =
      nodes.push({ name: children ? item.name : "", color: item.color, value: item.value, hatch: item.hatch }) - 1;
    links.push({ source: spentIdx, target: itemIdx, value: item.value });
    maxDepth = Math.max(maxDepth, 1);
    depthCounts[1] = (depthCounts[1] ?? 0) + 1;

    if (!children) {
      const passThroughIdx = nodes.push({ name: item.name, color: item.color, value: item.value, href: item.href }) - 1;
      links.push({ source: itemIdx, target: passThroughIdx, value: item.value });
      maxDepth = Math.max(maxDepth, 2);
      depthCounts[2] = (depthCounts[2] ?? 0) + 1;
      continue;
    }
    const sortedChildren = [...children].filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
    for (const c of sortedChildren) {
      const catIdx =
        nodes.push({ name: c.name, color: c.color ?? item.color, value: c.value, href: c.href, hatch: c.hatch }) - 1;
      links.push({ source: itemIdx, target: catIdx, value: c.value });
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
  const router = useRouter();
  const isLastColumn = payload.depth === maxDepth;
  const { href } = payload;
  // Drillable nodes (categories, projects) are links: click or Enter opens the page.
  const linkProps = href
    ? {
        role: "link",
        tabIndex: 0,
        "aria-label": `${payload.name}, ${formatAmountShort(payload.value)}`,
        onClick: () => router.push(href),
        onKeyDown: (e: KeyboardEvent) => e.key === "Enter" && router.push(href),
        className: "cursor-pointer outline-none hover:opacity-80 focus-visible:opacity-80 [&:hover_text:first-of-type]:underline",
      }
    : {};
  return (
    <Layer {...linkProps}>
      {payload.hatch && (
        <defs>{projectHatchPattern(SANKEY_HATCH_PREFIX, { id: payload.hatch.projectId, color: payload.hatch.color })}</defs>
      )}
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={payload.hatch ? projectHatchFill(SANKEY_HATCH_PREFIX, payload.hatch.projectId) : payload.color}
        fillOpacity={payload.hatch ? 1 : 0.85}
      />
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
  const stroke = payload.target.color; // tinted by where the money went
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={stroke}
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
  payload?: Array<{
    name?: string;
    value?: number;
    payload?: Pick<FlowNode, "income">;
  }>;
  formatAmountShort: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const income = payload[0].payload?.income;
  // recharts labels link hovers "Source - Target"; render as an arrow instead.
  const label = name?.includes(" - ") ? name.replace(" - ", " → ") : name;

  // Spent node only: how the month's income compares. Measured against the
  // budgeted income when there is one, otherwise what has been received.
  const base = income ? income.budgeted ?? income.received : 0;
  const diff = base - (value ?? 0);
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <div className="font-medium">{label}</div>
      <div className="tabular-nums text-muted-foreground">{formatAmountShort(value ?? 0)}</div>
      {income && base > 0 && (
        <div className="mt-1 space-y-0.5 border-t pt-1 tabular-nums text-muted-foreground">
          {income.budgeted != null && <div>Budgeted income {formatAmountShort(income.budgeted)}</div>}
          <div>Received {formatAmountShort(income.received)}</div>
          <div className={diff < 0 ? "text-destructive" : undefined}>
            {formatAmountShort(Math.abs(diff))} {diff < 0 ? "over" : "left"}
            {income.budgeted != null ? " of budget" : ""}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Spent → Category Group → Category money-flow diagram for the current
 * period, using actual spending (not planned amounts) so it shows where
 * money really went. Every bar's height is its own amount. The month's
 * income (budgeted and received) is only context, in the Spent node's tooltip.
 * Renders nothing if there's no spending yet.
 */
export function MoneyFlowSankey({
  tree,
  formatAmountShort,
  plannedIncome = null,
}: {
  tree: BudgetTree;
  formatAmountShort: (n: number) => string;
  /** The month's budgeted income, if set. */
  plannedIncome?: number | null;
}) {
  const flow = useMemo(() => buildMoneyFlow(tree, plannedIncome), [tree, plannedIncome]);

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
