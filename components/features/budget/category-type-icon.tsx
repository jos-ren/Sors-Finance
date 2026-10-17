"use client";

import { PiggyBank, Repeat } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { classifyCategory } from "@/lib/budget/classify";

/**
 * Marks a category's money class next to its name: a piggy bank for saving
 * categories, a repeat arrow for recurring bills. Plain spending gets nothing.
 */
export function CategoryTypeIcon({ category }: { category: Parameters<typeof classifyCategory>[0] }) {
  const kind = classifyCategory(category);
  if (kind === "spending") return null;

  const { Icon, className, label } =
    kind === "saving"
      ? { Icon: PiggyBank, className: "text-primary", label: "Saving" }
      : { Icon: Repeat, className: "text-sky-500", label: "Recurring bill" };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Icon className={`h-3.5 w-3.5 shrink-0 ${className}`} aria-label={label} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
