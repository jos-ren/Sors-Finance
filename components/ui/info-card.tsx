/**
 * InfoCard — consistent info/warning/danger/success notice block.
 * Designed to match the visual language of the Settings row components:
 *   - same p-4 padding, rounded-lg border container
 *   - same h-9 w-9 rounded-lg icon slot with semantic colour
 *   - title + body text layout
 *   - optional right-side action slot
 */

import React from "react";
import { Info, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type InfoCardVariant = "info" | "warning" | "danger" | "success" | "default";

const variantStyles: Record<
  InfoCardVariant,
  { container: string; iconWrap: string; iconColor: string; defaultIcon: React.ReactNode }
> = {
  info: {
    container: "border-blue-500/20 bg-blue-500/5",
    iconWrap: "bg-blue-500/10",
    iconColor: "text-blue-500",
    defaultIcon: <Info className="h-4 w-4" />,
  },
  warning: {
    container: "border-amber-500/20 bg-amber-500/5",
    iconWrap: "bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
    defaultIcon: <AlertTriangle className="h-4 w-4" />,
  },
  danger: {
    container: "border-destructive/20 bg-destructive/5",
    iconWrap: "bg-destructive/10",
    iconColor: "text-destructive",
    defaultIcon: <AlertCircle className="h-4 w-4" />,
  },
  success: {
    container: "border-green-500/20 bg-green-500/5",
    iconWrap: "bg-green-500/10",
    iconColor: "text-green-600 dark:text-green-400",
    defaultIcon: <CheckCircle2 className="h-4 w-4" />,
  },
  default: {
    container: "border bg-muted/30",
    iconWrap: "bg-muted",
    iconColor: "text-muted-foreground",
    defaultIcon: <Info className="h-4 w-4" />,
  },
};

interface InfoCardProps {
  variant?: InfoCardVariant;
  /** Override the icon; if omitted a sensible default is used per variant */
  icon?: React.ReactNode;
  /** Bold title line above the body */
  title?: string;
  /** Body content — can be a string or any ReactNode */
  children: React.ReactNode;
  /** Optional element pinned to the right (e.g. a Button) */
  action?: React.ReactNode;
  /** Full-width content rendered below the header row (e.g. expandable details) */
  footer?: React.ReactNode;
  /** Called when the icon or content area is clicked (not the action slot) */
  onClick?: () => void;
  className?: string;
}

export function InfoCard({
  variant = "default",
  icon,
  title,
  children,
  action,
  footer,
  onClick,
  className,
}: InfoCardProps) {
  const s = variantStyles[variant];
  const renderedIcon = icon ?? s.defaultIcon;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        s.container,
        className
      )}
    >
      {/* Header row: icon + content + action */}
      <div className="flex items-start gap-3">
        {/* Icon + Content — clickable when onClick is provided */}
        <div
          className={cn("flex items-start gap-3 flex-1 min-w-0", onClick && "cursor-pointer")}
          onClick={onClick}
        >
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              s.iconWrap
            )}
          >
            <span className={s.iconColor}>{renderedIcon}</span>
          </div>
          <div className="flex-1 min-w-0 space-y-1 pt-0.5">
            {title && <p className="text-sm font-medium leading-none">{title}</p>}
            <div className="text-sm text-muted-foreground">{children}</div>
          </div>
        </div>

        {/* Optional right-side action — height matches the icon slot so buttons center with the first row */}
        {action && <div className="shrink-0 flex items-center h-9">{action}</div>}
      </div>

      {/* Full-width footer below the header row — left-aligned with the title (past the icon + gap) */}
      {footer && (
        <div className="text-sm text-muted-foreground mt-3 ml-12 mr-9">{footer}</div>
      )}
    </div>
  );
}
