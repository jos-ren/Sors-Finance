"use client";

import React, { useRef, useState, useEffect } from "react";
import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  /** Optional custom badges to replace the default count badge */
  customBadges?: React.ReactNode;
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
  customBadges,
}: ResolveSectionProps) {
  const isComplete = status === "complete";
  const isInfo = status === "info";
  const hasContent = count > 0;

  const descriptionRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const checkTruncation = () => {
      if (descriptionRef.current) {
        setIsTruncated(descriptionRef.current.scrollWidth > descriptionRef.current.clientWidth);
      }
    };

    checkTruncation();
    window.addEventListener("resize", checkTruncation);
    return () => window.removeEventListener("resize", checkTruncation);
  }, [description]);

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
            "w-full flex items-center gap-3 px-4 py-3 text-left",
            "bg-muted hover:bg-muted/80 transition-colors",
            "border-b border-border/50",
            "sticky top-0 z-10"
          )}
        >
          {/* Expand/Collapse indicator */}
          <span className="text-muted-foreground shrink-0">
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>

          {/* Icon */}
          <span className="shrink-0">
            {icon}
          </span>

          {/* Title */}
          <span className="font-medium shrink-0">{title}</span>

          {/* Count badge(s) */}
          <span className="shrink-0">
            {customBadges ?? (
              <Badge variant={getBadgeVariant()} className={getBadgeClassName()}>
                {count}
              </Badge>
            )}
          </span>

          {/* Description - takes remaining space, truncates with tooltip */}
          {description && (
            isTruncated ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      ref={descriptionRef}
                      className="flex-1 text-sm text-muted-foreground truncate text-right"
                    >
                      {description}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-md">
                    <p>{description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <span
                ref={descriptionRef}
                className="flex-1 text-sm text-muted-foreground truncate text-right"
              >
                {description}
              </span>
            )
          )}
        </button>
      </CollapsibleTrigger>

      {/* Collapsible content - no border/card wrapper */}
      <CollapsibleContent>
        <div className="bg-card">
          {/* Bulk actions row */}
          {bulkActions && (
            <div className="flex items-center justify-end gap-2 px-4 py-2">
              {bulkActions}
            </div>
          )}

          {/* Main content area */}
          {hasContent ? (
            <div>{children}</div>
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
