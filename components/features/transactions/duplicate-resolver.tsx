"use client";

import { useRef, useLayoutEffect, useEffect, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Transaction } from "@/types";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DateCell, DescriptionCell, AmountCell } from "@/components/features/transactions/resolve-step";
import { useVirtualScroll } from "@/components/features/transactions/resolve-step/virtual-scroll-context";

const ROW_HEIGHT = 41;

interface DuplicateResolverProps {
  duplicateTransactions: Transaction[];
  onImport: (transactionId: string) => void;
  onSkip: (transactionId: string) => void;
}

export function DuplicateResolver({
  duplicateTransactions,
  onImport,
  onSkip,
}: DuplicateResolverProps) {
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
    count: duplicateTransactions.length,
    getScrollElement: () => outerScrollRef?.current ?? null,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
    scrollMargin,
  });

  if (duplicateTransactions.length === 0) return null;

  const getValue = (t: Transaction) => (t.importDuplicate ? "import" : "skip");

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
            const t = duplicateTransactions[vItem.index];
            return (
              <tr key={vItem.key} className="border-b transition-colors hover:bg-muted/50">
                <DateCell date={t.date} />
                <DescriptionCell description={t.description} />
                <AmountCell amountOut={t.amountOut} amountIn={t.amountIn} />
                <td className="p-2 text-right pr-6">
                  <div className="flex justify-end">
                    <ToggleGroup
                      type="single"
                      value={getValue(t)}
                      onValueChange={(value) => {
                        if (value === "import") onImport(t.id);
                        else if (value === "skip") onSkip(t.id);
                      }}
                      variant="outline"
                      size="sm"
                      className="h-7"
                    >
                      <ToggleGroupItem value="skip" className="text-xs px-3 h-7">Skip</ToggleGroupItem>
                      <ToggleGroupItem value="import" className="text-xs px-3 h-7">Import</ToggleGroupItem>
                    </ToggleGroup>
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
