"use client";

/* eslint-disable @next/next/no-img-element */
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Map of bank sources to their logo paths
const BANK_LOGOS: Record<string, string> = {
  // Add custom bank logos here
};

interface BankSourceBadgeProps {
  source: string;
  sourceMethod?: "Plaid" | "CSV" | "Manual";
  sourceAccountName?: string;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
}

export function BankSourceBadge({
  source,
  sourceMethod,
  sourceAccountName,
  size = "md",
  showTooltip = true,
}: BankSourceBadgeProps) {
  const logoPath = BANK_LOGOS[source];

  const imageSizes = {
    sm: { width: 16, height: 16, className: "h-4 w-auto" },
    md: { width: 20, height: 20, className: "h-5 w-auto" },
    lg: { width: 24, height: 24, className: "h-6 w-auto" },
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  // For banks with logos, just show the logo without a container
  const content = logoPath ? (
    <img
      src={logoPath}
      alt={`${source} logo`}
      className={`${imageSizes[size].className} w-auto object-contain`}
    />
  ) : (
    // For banks without logos, show a badge with icon and text
    <Badge variant="outline" className="flex items-center gap-1">
      <Building2 className={iconSizes[size]} />
      <span className="text-xs">{source}</span>
    </Badge>
  );

  if (!showTooltip) {
    return content;
  }

  // Build tooltip content
  const tooltipLines: string[] = [source];
  if (sourceMethod) {
    tooltipLines.push(`Imported via ${sourceMethod}`);
  }
  if (sourceAccountName) {
    tooltipLines.push(`Account: ${sourceAccountName}`);
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center">
            {content}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-0.5">
            {tooltipLines.map((line, i) => (
              <p key={i} className={i === 0 ? "font-medium" : "text-muted-foreground text-xs"}>
                {line}
              </p>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
