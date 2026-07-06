"use client";

import { Target, MoreHorizontal, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { InlineRename } from "@/components/features/budget/manage/inline-edit";

export interface BuilderItem {
  id: number;
  name: string;
  itemType: "expense" | "goal";
  planned: number; // effective (pending overlaid upstream)
}

/**
 * Builder allocation row: a dedicated drag handle, inline rename,
 * % of income, a $ input, and a details menu.
 */
export function AllocationItemRow({
  item,
  income,
  pendingValue,
  dirty,
  formatAmount,
  onChange,
  onRename,
  onOpenDetail,
}: {
  item: BuilderItem;
  income: number;
  pendingValue: string | undefined;
  dirty: boolean;
  formatAmount: (n: number) => string;
  onChange: (value: string) => void;
  onRename: (name: string) => void;
  onOpenDetail: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `sub:${item.id}` });
  const planned = item.planned;
  const inputValue = pendingValue !== undefined ? pendingValue : planned ? planned.toFixed(2) : "";
  const pctOfIncome = income > 0 ? (planned / income) * 100 : 0;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2 py-1.5", isDragging && "opacity-60")}
    >
      <button className="-m-1 shrink-0 cursor-grab touch-none p-1 text-muted-foreground" {...attributes} {...listeners} aria-label={`Drag ${item.name}`}>
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <div className="flex min-w-0 flex-[2] items-center gap-1.5">
        {item.itemType === "goal" && <Target className="h-3.5 w-3.5 shrink-0 text-primary" />}
        <InlineRename value={item.name} onCommit={onRename} className="text-sm" />
        {income > 0 && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{pctOfIncome.toFixed(0)}%</span>
        )}
      </div>

      <div className="relative w-28 shrink-0">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
        <CurrencyInput
          value={inputValue}
          onChange={onChange}
          placeholder="0.00"
          size="sm"
          className={cn("h-8 pl-5 text-right text-sm tabular-nums", dirty && "border-primary ring-1 ring-primary/30")}
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onOpenDetail}>Category details…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
