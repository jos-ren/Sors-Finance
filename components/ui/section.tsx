"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// ─── Section header ───────────────────────────────────────────────────────────

export function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-0.5">
      {label}
    </p>
  );
}

// ─── Row group (rounded bordered container with dividers) ─────────────────────

export function RowGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border overflow-hidden divide-y divide-border bg-card">
      {children}
    </div>
  );
}

// ─── Accordion row ──────────────────────────────────────────────────────────────
// Collapsible parent row matching the connected-banks visual pattern.
// Optionally limits visible children with a Close / Show All footer.

interface AccordionRowProps {
  /** Icon element rendered in the 9×9 rounded container */
  icon: React.ReactNode;
  /** Primary label */
  title: string;
  /** Small muted text below the title */
  subtitle?: string;
  /** Expanded child rows */
  children: React.ReactNode;
  /** Max children shown on first expand. Enables Close / Show All footer. */
  maxItems?: number;
}

export function AccordionRow({
  icon,
  title,
  subtitle,
  children,
  maxItems,
}: AccordionRowProps) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) setShowAll(false);
  };

  const childArray = React.Children.toArray(children);
  const totalItems = childArray.length;
  const hasLimit = maxItems != null && totalItems > maxItems;
  const visibleChildren = hasLimit && !showAll ? childArray.slice(0, maxItems) : childArray;

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <div>
        {/* Parent row */}
        <div className="flex items-center gap-3 p-4">
          <CollapsibleTrigger asChild>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted cursor-pointer">
              {icon}
            </div>
          </CollapsibleTrigger>
          <CollapsibleTrigger asChild>
            <div className="flex-1 min-w-0 cursor-pointer">
              <p className="text-sm font-medium">{title}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="cursor-pointer">
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
            </Button>
          </CollapsibleTrigger>
        </div>

        {/* Expanded children */}
        <CollapsibleContent>
          <div className="border-t bg-muted/20 divide-y divide-border">
            {visibleChildren}

            {/* Footer — only when maxItems is set */}
            {maxItems != null && (
              <div className="flex items-center justify-center gap-3 px-4 py-3">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Close
                </Button>
                {hasLimit && !showAll && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAll(true)}
                  >
                    Show All ({totalItems})
                  </Button>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
