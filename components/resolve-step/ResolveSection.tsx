"use client";

import React from "react";
import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type ResolveSectionStatus = "pending" | "complete" | "info";

interface ResolveSectionProps {
  /** Section title */
  title: string;
  /** Icon to display (when not complete) */
  icon: React.ReactNode;
  /** Number of items in this section */
  count: number;
  /** Status determines styling: pending (needs action), complete (done), info (read-only) */
  status: ResolveSectionStatus;
  /** Description text shown when expanded */
  description?: string;
  /** Whether this section is blocking (prevents import) */
  isBlocking?: boolean;
  /** Whether the section is expanded */
  isOpen: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Optional bulk action buttons (rendered in header) */
  bulkActions?: React.ReactNode;
  /** Content to render when expanded (typically a table) */
  children?: React.ReactNode;
  /** Custom empty state message when count is 0 */
  emptyMessage?: string;
  /** Custom complete message when all items resolved */
  completeMessage?: string;
}

export function ResolveSection({
  title,
  icon,
  count,
  status,
  description,
  isBlocking = false,
  isOpen,
  onOpenChange,
  bulkActions,
  children,
  emptyMessage = "No items to show",
  completeMessage = "All done!",
}: ResolveSectionProps) {
  const isComplete = status === "complete";
  const isInfo = status === "info";
  const hasContent = count > 0;

  // Badge styling based on status
  const getBadgeVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    if (isComplete) return "secondary";
    if (isInfo) return "default";
    if (isBlocking && count > 0) return "destructive";
    return "secondary";
  };

  const getBadgeClassName = () => {
    if (isComplete) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (isInfo) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (isBlocking && count > 0) return "";
    return "";
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      {/* Header - always visible, with distinct background */}
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-between px-4 py-3 text-left",
            "bg-muted/50 hover:bg-muted/70 transition-colors",
            "border-b border-border/50",
            "sticky top-0 z-10",
            isComplete && "bg-green-50/50 dark:bg-green-950/20 hover:bg-green-50/70 dark:hover:bg-green-950/30"
          )}
        >
          <div className="flex items-center gap-3">
            {/* Expand/Collapse indicator */}
            <span className="text-muted-foreground">
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>

            {/* Icon - show checkmark when complete */}
            <span className={cn(
              isComplete && "text-green-600 dark:text-green-400",
              isInfo && "text-green-600 dark:text-green-400"
            )}>
              {isComplete ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                icon
              )}
            </span>

            {/* Title */}
            <span className="font-medium">{title}</span>

            {/* Count badge */}
            <Badge variant={getBadgeVariant()} className={getBadgeClassName()}>
              {count}
            </Badge>
          </div>

          {/* Collapsed summary when not open */}
          {!isOpen && isComplete && (
            <span className="text-sm text-muted-foreground">
              {completeMessage}
            </span>
          )}
        </button>
      </CollapsibleTrigger>

      {/* Collapsible content - no border/card wrapper */}
      <CollapsibleContent>
        <div className="px-4 py-3 bg-card">
          {/* Description and bulk actions row */}
          {(description || bulkActions) && (
            <div className="flex items-start justify-between gap-4 pb-3">
              {description && (
                <p className="text-sm text-muted-foreground flex-1">
                  {description}
                </p>
              )}
              {bulkActions && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {bulkActions}
                </div>
              )}
            </div>
          )}

          {/* Main content area */}
          {hasContent ? (
            <div>
              {children}
            </div>
          ) : (
            <div className="py-6 text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>{emptyMessage}</p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
