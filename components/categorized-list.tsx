"use client";

import { useRef, useLayoutEffect, useEffect, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Transaction } from "@/types";
import { DbCategory } from "@/lib/db";
import { DateCell, DescriptionCell, AmountCell } from "@/components/features/transactions/resolve-step";
import { useVirtualScroll } from "@/components/features/transactions/resolve-step/virtual-scroll-context";

const ROW_HEIGHT = 41;

interface CategorizedListProps {
  transactions: Transaction[];
  categories: DbCategory[];
  onChangeCategory: (transactionId: string, categoryId: string) => void;
}

export function CategorizedList({ transactions, categories, onChangeCategory }: CategorizedListProps) {
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

  const selectableCategories = categories.filter(c => c.name.toLowerCase() !== "uncategorized");

  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => outerScrollRef?.current ?? null,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
    scrollMargin,
  });

  if (transactions.length === 0) return null;

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start - scrollMargin : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end + scrollMargin
      : 0;

  return (
    <div ref={containerRef}>
      <table className="w-full caption-bottom text-sm" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 120 }} />
          <col />
          <col style={{ width: 100 }} />
          <col style={{ width: 200 }} />
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
            const t = transactions[vItem.index];
            return (
              <tr key={vItem.key} className="border-b transition-colors hover:bg-muted/50">
                <DateCell date={t.date} />
                <DescriptionCell description={t.description} />
                <AmountCell amountOut={t.amountOut} amountIn={t.amountIn} />
                <td className="p-2 text-right pr-6">
                  <div className="flex justify-end">
                    <Select
                      value={t.categoryId || undefined}
                      onValueChange={(value) => onChangeCategory(t.id, value)}
                    >
                      <SelectTrigger className="w-[140px] h-7 text-xs">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableCategories.map((c) => (
                          <SelectItem key={c.uuid} value={c.uuid} className="text-xs">
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </td>
              </tr>
            );
          })}
          {paddingBottom > 0 && <tr><td colSpan={4} style={{ height: paddingBottom }} /></tr>}
        </tbody>
      </table>
    </div>
  );
}
