"use client";

import Image from "next/image";
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
  CIBC: "/logos/cibc.png",
  AMEX: "/logos/amex.png",
};

interface BankSourceBadgeProps {
  source: string;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
}

export function BankSourceBadge({
  source,
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
    <Image
      src={logoPath}
      alt={`${source} logo`}
      width={imageSizes[size].width}
      height={imageSizes[size].height}
      className={`${imageSizes[size].className} object-contain`}
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

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center">
            {content}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{source}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
