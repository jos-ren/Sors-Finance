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
// Keys match Plaid institutionName values and/or CSV template names
const BANK_LOGOS: Record<string, string> = {
  // TD
  "TD": "/logos/banks/td.png",
  "TD Bank": "/logos/banks/td.png",
  "TD Canada Trust": "/logos/banks/td.png",

  // RBC
  "RBC": "/logos/banks/rbc.png",
  "Royal Bank of Canada": "/logos/banks/rbc.png",
  "RBC Royal Bank": "/logos/banks/rbc.png",

  // CIBC
  "CIBC": "/logos/banks/cibc.png",

  // BMO
  "BMO": "/logos/banks/bmo.png",
  "Bank of Montreal": "/logos/banks/bmo.png",
  "BMO Bank of Montreal": "/logos/banks/bmo.png",

  // Scotiabank
  "Scotiabank": "/logos/banks/scotiabank.svg",
  "Bank of Nova Scotia": "/logos/banks/scotiabank.svg",

  // National Bank
  "National Bank": "/logos/banks/nationalbank.png",
  "National Bank of Canada": "/logos/banks/nationalbank.png",

  // Wealthsimple
  "Wealthsimple": "/logos/banks/wealthsimple.png",

  // Tangerine
  "Tangerine": "/logos/banks/tangerine.png",

  // American Express
  "Amex": "/logos/banks/amex.png",
  "American Express": "/logos/banks/amex.png",

  // ATB Financial
  "ATB": "/logos/banks/atb.png",
  "ATB Financial": "/logos/banks/atb.png",

  // Desjardins
  "Desjardins": "/logos/banks/desjardins.jpg",

  // Vancity
  "Vancity": "/logos/banks/vancity.jpg",
  "Vancouver City Savings": "/logos/banks/vancity.jpg",
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
