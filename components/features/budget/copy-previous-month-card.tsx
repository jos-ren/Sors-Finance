"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Prompt shown on an empty month offering to copy the previous month's budget
 * (item-based). Preserves the auto-copy setting via "Always Copy".
 */
export function CopyPreviousMonthCard({
  previous,
  isCopying,
  onCopy,
  onAlwaysCopy,
}: {
  previous: { year: number; month: number };
  isCopying: boolean;
  onCopy: () => void;
  onAlwaysCopy: () => void;
}) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Copy className="h-5 w-5 text-primary" />
          <p className="text-sm">
            Copy budget amounts from{" "}
            <span className="font-medium">
              {MONTH_NAMES[previous.month]} {previous.year}
            </span>
            ?
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onCopy} disabled={isCopying} className="gap-1.5">
            <Copy className="h-4 w-4" />
            {isCopying ? "Copying…" : "Copy"}
          </Button>
          <Button size="sm" variant="outline" onClick={onAlwaysCopy} disabled={isCopying}>
            {isCopying ? "Copying…" : "Always Copy"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
