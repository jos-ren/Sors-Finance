"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileClock,
  Loader2,
  TrendingUp,
  Bitcoin,
  Coins,
  Landmark,
  Circle,
  ArrowDown,
  Plus,
  Minus,
  RefreshCw,
  Trash2,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { SectionHeader } from "@/components/ui/section";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getPortfolioHistory } from "@/lib/db/client/portfolio";
import type { DbPortfolioItemHistory } from "@/lib/db/types";
import { useCurrency } from "@/lib/settings-context";
import { usePrivacy } from "@/lib/privacy-context";
import { useSetPageHeader } from "@/lib/page-header-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HistoryEntry extends DbPortfolioItemHistory {
  itemName: string;
  itemType?: string;
  accountBucket: string;
  accountName: string;
}

// ---------------------------------------------------------------------------
// Action indicators: icon + colors (replaces text badges)
// ---------------------------------------------------------------------------

interface ActionStyle {
  icon: LucideIcon;
  iconColor: string;
  pipBg: string;
  rowTint: string;
  tooltip: string;
}

const ACTION_STYLES: Record<string, ActionStyle> = {
  // Market actions — green/red icons
  price_refresh: { icon: RefreshCw, iconColor: "text-amber-400", pipBg: "bg-amber-500/20", rowTint: "", tooltip: "Price refresh" },
  price_up: { icon: TrendingUp, iconColor: "text-emerald-400", pipBg: "bg-emerald-500/20", rowTint: "bg-emerald-500/[0.02]", tooltip: "Price increase" },
  price_down: { icon: ArrowDown, iconColor: "text-red-400", pipBg: "bg-red-500/20", rowTint: "bg-red-500/[0.02]", tooltip: "Price decrease" },
  appreciation: { icon: TrendingUp, iconColor: "text-emerald-400", pipBg: "bg-emerald-500/20", rowTint: "bg-emerald-500/[0.02]", tooltip: "Appreciation" },
  depreciation: { icon: ArrowDown, iconColor: "text-red-400", pipBg: "bg-red-500/20", rowTint: "bg-red-500/[0.02]", tooltip: "Depreciation" },
  plaid_sync: { icon: RefreshCw, iconColor: "text-purple-400", pipBg: "bg-purple-500/20", rowTint: "", tooltip: "Plaid sync" },

  // User actions — blue/amber (distinct from market green/red)
  buy: { icon: Plus, iconColor: "text-blue-400", pipBg: "bg-blue-500/20", rowTint: "bg-blue-500/[0.02]", tooltip: "Buy" },
  sell: { icon: Minus, iconColor: "text-amber-400", pipBg: "bg-amber-500/20", rowTint: "bg-amber-500/[0.02]", tooltip: "Sell" },
  created: { icon: Plus, iconColor: "text-blue-400", pipBg: "bg-blue-500/20", rowTint: "bg-blue-500/[0.02]", tooltip: "Added" },
  deleted: { icon: Trash2, iconColor: "text-muted-foreground", pipBg: "bg-muted", rowTint: "bg-red-500/[0.02]", tooltip: "Deleted" },
  deposit: { icon: Plus, iconColor: "text-blue-400", pipBg: "bg-blue-500/20", rowTint: "bg-emerald-500/[0.02]", tooltip: "Deposit" },
  withdrawal: { icon: Minus, iconColor: "text-amber-400", pipBg: "bg-amber-500/20", rowTint: "bg-amber-500/[0.02]", tooltip: "Withdrawal" },
  payment: { icon: Minus, iconColor: "text-blue-400", pipBg: "bg-blue-500/20", rowTint: "bg-emerald-500/[0.02]", tooltip: "Payment" },
  manual: { icon: Pencil, iconColor: "text-muted-foreground", pipBg: "bg-muted", rowTint: "", tooltip: "Manual edit" },
};

// ---------------------------------------------------------------------------
// Derive action key from entry data
// ---------------------------------------------------------------------------

function getSourceKey(entry: HistoryEntry): string {
  if (entry.source !== "manual") return entry.source;

  const qtyChange = entry.changes.find((c) => c.field === "quantity");
  const valueChange = entry.changes.find((c) => c.field === "currentValue");
  const bucket = entry.accountBucket;

  if (bucket === "Investments" && qtyChange) {
    const diff = (Number(qtyChange.newValue) || 0) - (Number(qtyChange.oldValue) || 0);
    if (diff > 0) return "buy";
    if (diff < 0) return "sell";
  }
  if (bucket === "Savings" && valueChange) {
    const diff = (Number(valueChange.newValue) || 0) - (Number(valueChange.oldValue) || 0);
    if (diff > 0) return "deposit";
    if (diff < 0) return "withdrawal";
  }
  if (bucket === "Debt" && valueChange) {
    const diff = (Number(valueChange.newValue) || 0) - (Number(valueChange.oldValue) || 0);
    if (diff < 0) return "payment";
    if (diff > 0) return "withdrawal";
  }
  if (bucket === "Assets" && valueChange) {
    const diff = (Number(valueChange.newValue) || 0) - (Number(valueChange.oldValue) || 0);
    if (diff > 0) return "appreciation";
    if (diff < 0) return "depreciation";
  }

  return "manual";
}

// Refine price_refresh into price_up/price_down for directional styling
function getActionStyle(actionKey: string, deltaNum: number): ActionStyle {
  if (actionKey === "price_refresh") {
    if (deltaNum > 0) return ACTION_STYLES.price_up;
    if (deltaNum < 0) return ACTION_STYLES.price_down;
  }
  if (actionKey === "plaid_sync") {
    if (deltaNum > 0) return { ...ACTION_STYLES.plaid_sync, rowTint: "bg-emerald-500/[0.02]" };
    if (deltaNum < 0) return { ...ACTION_STYLES.plaid_sync, rowTint: "bg-red-500/[0.02]" };
  }
  return ACTION_STYLES[actionKey] || ACTION_STYLES.manual;
}

// ---------------------------------------------------------------------------
// Item type → icon
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<string, { icon: LucideIcon; className: string }> = {
  stock: { icon: TrendingUp, className: "text-blue-500" },
  crypto: { icon: Bitcoin, className: "text-orange-500" },
  metal: { icon: Coins, className: "text-yellow-500" },
  bank: { icon: Landmark, className: "text-blue-700 dark:text-blue-400" },
  other: { icon: Circle, className: "text-muted-foreground" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getChange(entry: HistoryEntry, field: string) {
  return entry.changes.find((c) => c.field === field);
}

function num(v: string | number | null | undefined): number {
  return Number(v) || 0;
}

// ---------------------------------------------------------------------------
// Zone 2: Transaction detail summary
// ---------------------------------------------------------------------------

function transactionSummary(
  entry: HistoryEntry,
  actionKey: string,
  fmtShort: (v: number, c: string) => string,
  currency: string,
): string {
  const qtyChange = getChange(entry, "quantity");
  const valueChange = getChange(entry, "currentValue");
  const ppuChange = getChange(entry, "pricePerUnit");
  const nameChange = getChange(entry, "name");

  if (actionKey === "buy" || actionKey === "sell") {
    const qtyDelta = Math.abs(num(qtyChange?.newValue) - num(qtyChange?.oldValue));
    const ppu = num(ppuChange?.newValue ?? ppuChange?.oldValue);
    const verb = actionKey === "buy" ? "Bought" : "Sold";
    if (ppu > 0) return `${verb} ${qtyDelta} @ ${fmtShort(ppu, currency)}/ea`;
    return `${verb} ${qtyDelta}`;
  }

  if (actionKey === "created") {
    if (qtyChange && ppuChange) {
      return `Added ${qtyChange.newValue} @ ${fmtShort(num(ppuChange.newValue), currency)}/ea`;
    }
    if (qtyChange) return `Added ${qtyChange.newValue}`;
    if (valueChange) return fmtShort(num(valueChange.newValue), currency);
    return "Item added";
  }

  if (actionKey === "deposit" || actionKey === "withdrawal" || actionKey === "payment") {
    const delta = num(valueChange?.newValue) - num(valueChange?.oldValue);
    const sign = delta >= 0 ? "+" : "-";
    return `${sign} ${fmtShort(Math.abs(delta), currency)}`;
  }

  if (actionKey === "appreciation" || actionKey === "depreciation") {
    const delta = num(valueChange?.newValue) - num(valueChange?.oldValue);
    const sign = delta >= 0 ? "+" : "-";
    return `${sign} ${fmtShort(Math.abs(delta), currency)}`;
  }

  if (actionKey === "price_refresh") {
    if (ppuChange) {
      return `${fmtShort(num(ppuChange.oldValue), currency)} → ${fmtShort(num(ppuChange.newValue), currency)}/ea`;
    }
    if (valueChange) {
      return `${fmtShort(num(valueChange.oldValue), currency)} → ${fmtShort(num(valueChange.newValue), currency)}`;
    }
  }

  if (actionKey === "plaid_sync") {
    if (valueChange) {
      return `${fmtShort(num(valueChange.oldValue), currency)} → ${fmtShort(num(valueChange.newValue), currency)}`;
    }
  }

  if (actionKey === "deleted") {
    if (valueChange) return `Was ${fmtShort(num(valueChange.oldValue), currency)}`;
    return "Item removed";
  }

  if (nameChange && !valueChange && !qtyChange && !ppuChange) {
    return `${nameChange.oldValue} → ${nameChange.newValue}`;
  }

  if (ppuChange) {
    return `${fmtShort(num(ppuChange.newValue), currency)}/ea`;
  }
  if (valueChange) {
    return `${fmtShort(num(valueChange.newValue), currency)}`;
  }

  return "—";
}

// ---------------------------------------------------------------------------
// Zone 3: Net change (delta) and new balance
// ---------------------------------------------------------------------------

function netChange(
  entry: HistoryEntry,
  fmt: (v: number, c: string) => string,
  currency: string,
): { delta: string; balance: string; deltaNum: number } | null {
  const valueChange = getChange(entry, "currentValue");
  const ppuChange = getChange(entry, "pricePerUnit");

  if (valueChange) {
    const oldVal = num(valueChange.oldValue);
    const newVal = num(valueChange.newValue);
    const deltaNum = newVal - oldVal;
    const sign = deltaNum >= 0 ? "+" : "-";

    return {
      delta: `${sign}${fmt(Math.abs(deltaNum), currency)}`,
      balance: `Bal: ${fmt(newVal, currency)}`,
      deltaNum,
    };
  }

  if (ppuChange) {
    const oldPpu = num(ppuChange.oldValue);
    const newPpu = num(ppuChange.newValue);
    const deltaNum = newPpu - oldPpu;
    const sign = deltaNum >= 0 ? "+" : "-";

    return {
      delta: `${sign}${fmt(Math.abs(deltaNum), currency)}/ea`,
      balance: `Price: ${fmt(newPpu, currency)}`,
      deltaNum,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Color logic — only market actions get red/green on the delta text
// ---------------------------------------------------------------------------

const MARKET_ACTIONS = new Set(["price_refresh", "appreciation", "depreciation", "plaid_sync"]);

function deltaColor(actionKey: string, deltaNum: number): string {
  if (!MARKET_ACTIONS.has(actionKey)) return "";
  if (deltaNum === 0) return "text-muted-foreground";
  if (deltaNum > 0) return "text-emerald-600 dark:text-emerald-400";
  if (deltaNum < 0) return "text-red-600 dark:text-red-400";
  return "";
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PortfolioHistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const userCurrency = useCurrency();
  const { formatAmount } = usePrivacy();

  const sentinelRef = useSetPageHeader("Change History");

  const fmtShort = (v: number, c: string) => formatAmount(v, c, false);

  useEffect(() => {
    setIsLoading(true);
    getPortfolioHistory()
      .then((data) => setHistory(data as HistoryEntry[]))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const groupedByDate = history.reduce<Record<string, HistoryEntry[]>>((acc, entry) => {
    const date = new Date(entry.createdAt);
    const key = date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb className="mb-2">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/portfolio">Portfolio</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Change History</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center gap-3">
          <FileClock className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Change History</h1>
            <p className="text-muted-foreground">Recent changes across all portfolio items</p>
          </div>
        </div>
        <div ref={sentinelRef} className="h-0" />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileClock className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">No history yet</p>
          <p className="text-sm mt-1">Changes will appear here after edits, syncs, or price refreshes.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([dateLabel, entries]) => (
            <section key={dateLabel} className="space-y-2">
              <SectionHeader label={dateLabel} />
              <div className="rounded-lg border border-border/40 overflow-hidden bg-card">
                {entries.map((entry, idx) => {
                  const actionKey = getSourceKey(entry);
                  const date = new Date(entry.createdAt);
                  const typeKey = entry.itemType || entry.type || "other";
                  const typeInfo = TYPE_ICONS[typeKey] || TYPE_ICONS.other;
                  const TypeIcon = typeInfo.icon;

                  const summary = transactionSummary(entry, actionKey, fmtShort, userCurrency);
                  const impact = netChange(entry, formatAmount, userCurrency);
                  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

                  const style = getActionStyle(actionKey, impact?.deltaNum ?? 0);
                  const ActionIcon = style.icon;

                  return (
                    <div
                      key={entry.id}
                      className={`grid grid-cols-[2fr_1.5fr_1fr] items-center gap-x-6 px-4 py-3 ${style.rowTint} ${
                        idx > 0 ? "border-t border-border/30" : ""
                      }`}
                    >
                      {/* Col 1: Identity & Action */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                          <TypeIcon className={`h-4.5 w-4.5 ${typeInfo.className}`} />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ${style.pipBg} border border-border/50 cursor-default`}>
                                <ActionIcon className={`h-2.5 w-2.5 ${style.iconColor}`} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {style.tooltip}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-medium truncate block">{entry.itemName}</span>
                          <p className="text-[11px] text-muted-foreground/70 truncate">
                            {entry.accountName} · {entry.accountBucket}
                          </p>
                        </div>
                      </div>

                      {/* Col 2: Transaction Details (left-aligned) */}
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground/60 truncate">{summary}</p>
                      </div>

                      {/* Col 3: Financial Impact & Time (right-aligned) */}
                      <div className="text-right">
                        {impact ? (
                          <>
                            <p className={`text-sm font-semibold tabular-nums ${deltaColor(actionKey, impact.deltaNum)}`}>
                              {impact.delta}
                            </p>
                            <p className="text-[11px] text-muted-foreground/50 tabular-nums">
                              {impact.balance}
                            </p>
                            <p className="text-[10px] text-muted-foreground/40 tabular-nums">
                              {time}
                            </p>
                          </>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/50">
                            {time}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
