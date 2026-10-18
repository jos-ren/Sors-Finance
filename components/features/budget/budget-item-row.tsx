"use client";

import Link from "next/link";
import type { BudgetTreeCategory } from "@/lib/budget/types";
import { SavingProgress } from "./saving-progress";
import { CategoryTypeIcon } from "./category-type-icon";

/**
 * A budget category row: name | total spent this period (read-only — planned
 * amounts are set in the Builder). Clicking the name/amount opens the
 * category's page, which lists its transactions for the month.
 * Spending on separately funded projects is not in the total; a note links to
 * the project instead.
 * TODO: no entry point for category actions right now (menu removed pending
 * a new home for it — onOpenDetail is unused until then).
 */
export function BudgetItemRow({
  item,
  formatAmountShort,
  drillHref,
  onOpenDetail: _onOpenDetail,
}: {
  item: BudgetTreeCategory;
  formatAmountShort: (n: number) => string;
  drillHref: string;
  onOpenDetail: () => void;
}) {
  const isSaving = item.itemType === "saving";
  const projectTotal = item.projectSpend.reduce((a, p) => a + p.amount, 0);
  const projectNote =
    item.projectSpend.length === 1
      ? { href: `/projects/${item.projectSpend[0].projectId}`, label: `+${formatAmountShort(projectTotal)} in ${item.projectSpend[0].name}` }
      : item.projectSpend.length > 1
        ? { href: "/projects", label: `+${formatAmountShort(projectTotal)} in ${item.projectSpend.length} projects` }
        : null;

  return (
    <div className="flex items-center gap-1 py-1.5 pl-2 pr-2">
      {/* Sized/positioned to exactly match the group row's chevron (h-4 w-4,
          flush against the row's left padding, no extra centering box) so
          the depth-guide lines — which assume a fixed offset — line up
          under this chevron the same way they do under a group's. */}
      <span className="h-4 w-4 shrink-0" aria-hidden />

      <Link href={drillHref} className="group flex flex-1 items-center gap-3">
        {/* Name */}
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm">
          <CategoryTypeIcon category={item} />
          <span className="truncate underline-offset-4 group-hover:underline">{item.name}</span>
          {!item.isActive && (
            <span className="rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">archived</span>
          )}
        </span>
        {isSaving && item.targetAmount != null && item.targetAmount > 0 && (
          <SavingProgress
            saved={item.contributed}
            target={item.targetAmount}
            formatAmount={formatAmountShort}
            className="mt-0.5 max-w-[220px]"
          />
        )}

        <span className="shrink-0 text-right text-sm tabular-nums text-muted-foreground">
          {formatAmountShort(item.actual)}
        </span>
      </Link>
      {projectNote && (
        <Link
          href={projectNote.href}
          className="shrink-0 rounded px-1 text-xs tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Funded separately, not counted in this month's budget"
        >
          {projectNote.label}
        </Link>
      )}
    </div>
  );
}
