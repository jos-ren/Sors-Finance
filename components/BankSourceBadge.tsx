"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IconBadge } from "@/components/ui/icon-badge";
import { getBankLogo, getBankFallbackColor, resolveBankLogoSrc } from "@/lib/bank-logos";

interface BankSourceBadgeProps {
  source: string;
  sourceMethod?: "Plaid" | "CSV" | "Manual";
  sourceAccountName?: string;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function BankSourceBadge({
  source,
  sourceMethod,
  sourceAccountName,
  size = "md",
  showTooltip = true,
}: BankSourceBadgeProps) {
  const [imgError, setImgError] = useState(false);
  const badgeSizes = { sm: "sm", md: "md", lg: "lg" } as const;
  const logoData = getBankLogo(source);
  const useTextFallback = !logoData || sourceMethod === "Manual" || imgError;

  let badgeClassName: string;
  let inner: React.ReactNode;

  const imgRadius = { sm: "rounded-md", md: "rounded-[8px]", lg: "rounded-[10px]" }[size];

  if (!useTextFallback && logoData) {
    badgeClassName = logoData.bg;
    inner = (
      <img
        src={resolveBankLogoSrc(logoData)}
        alt={`${source} logo`}
        className={`h-full w-full object-contain p-1.5 ${imgRadius}`}
        onError={() => setImgError(true)}
      />
    );
  } else {
    const label = sourceMethod === "Manual" ? "Manual" : source;
    badgeClassName = getBankFallbackColor(label);
    inner = (
      <span className="text-[10px] font-semibold leading-none select-none">
        {sourceMethod === "Manual" ? "M" : getInitials(source)}
      </span>
    );
  }

  const badge = (
    <IconBadge size={badgeSizes[size]} className={badgeClassName}>
      {inner}
    </IconBadge>
  );

  if (!showTooltip) return badge;

  const tooltipLines: string[] = [source];
  if (sourceMethod) tooltipLines.push(`Imported via ${sourceMethod}`);
  if (sourceAccountName) tooltipLines.push(`Account: ${sourceAccountName}`);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
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
