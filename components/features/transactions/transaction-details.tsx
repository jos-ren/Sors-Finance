"use client";

import { useMemo } from "react";
import { format, isSameYear, isToday, isYesterday } from "date-fns";
import { Globe, Sparkles, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePlaidInstitutions, type PlaidInstitutionSummary } from "@/hooks";
import { formatPlaidCategory } from "@/lib/categories/plaid-category";
import type { DbTransaction } from "@/lib/db/types";

/** Only online gets an icon: in store is the common case and says nothing. */
const CHANNEL_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  online: { icon: Globe, label: "Online" },
};

/** Day header label: Today, Yesterday, then "Wed, Oct 15" (year added when not this year). */
export function dayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, isSameYear(date, new Date()) ? "EEE, MMM d" : "EEE, MMM d, yyyy");
}

/** Plaid account → "what we call it" (Accounts item name, else the bank's own name for it). */
interface AccountLookup {
  byId: Map<string, string>;
  byName: Map<string, string>;
}

function buildAccountLookup(institutions: PlaidInstitutionSummary[] | undefined): AccountLookup {
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const inst of institutions ?? []) {
    for (const acc of inst.accounts) {
      const bankName = acc.officialName || acc.name;
      const label = acc.portfolioItemName || (acc.mask ? `${bankName} ••${acc.mask}` : bankName);
      byId.set(acc.accountId, label);
      // Older imports only stored Plaid's account name; match those by bank + name
      byName.set(`${inst.institutionName}|${acc.name}`, label);
      byName.set(`${inst.institutionName}|${bankName}`, label);
    }
  }
  return { byId, byName };
}

/** The account's name from Accounts when it is linked, else the bank's own name for it. */
export function accountLabel(t: DbTransaction, lookup: AccountLookup): string | null {
  const plaidId = t.details?.plaidAccountId;
  return (
    (plaidId && lookup.byId.get(plaidId)) ||
    (t.sourceAccountName && lookup.byName.get(`${t.source}|${t.sourceAccountName}`)) ||
    (t.sourceMethod === "Plaid" ? null : t.sourceAccountName) ||
    null
  );
}

/** Account name only: the bank's logo already sits beside the row. */
function accountPart(t: DbTransaction, lookup: AccountLookup): string {
  return accountLabel(t, lookup) ?? t.source;
}

/** Secondary line text: date (optional), time, account, place. Only what the bank gave us. */
function metaParts(t: DbTransaction, lookup: AccountLookup, showDate: boolean): string[] {
  const parts: string[] = [];
  if (showDate) parts.push(format(t.date, "MMM d"));
  if (t.transactedAt) parts.push(format(t.transactedAt, "h:mm a"));
  parts.push(accountPart(t, lookup));
  const place = [t.details?.city, t.details?.region].filter(Boolean).join(", ");
  if (place) parts.push(place);
  return parts;
}

/** The raw bank string, unless it is exactly the title. */
function rawDescription(t: DbTransaction): string | null {
  const raw = t.originalDescription?.trim();
  return raw && raw !== t.description.trim() ? raw : null;
}

/** Shared lookup so a list renders without rebuilding it per row. */
export function useAccountLookup(): AccountLookup {
  const institutions = usePlaidInstitutions();
  return useMemo(() => buildAccountLookup(institutions), [institutions]);
}

/**
 * The bank context under a transaction's name: when, which account, how and
 * where, then the raw bank string and Plaid's category guess. Used by the
 * review inbox and the budget category page.
 */
export function TransactionDetailLines({
  transaction: t,
  lookup,
  showDate = false,
}: {
  transaction: DbTransaction;
  lookup: AccountLookup;
  showDate?: boolean;
}) {
  const raw = rawDescription(t);
  const bankCategory = t.details?.plaidCategory ? formatPlaidCategory(t.details.plaidCategory) : null;

  const channel = t.details?.paymentChannel ? CHANNEL_ICONS[t.details.paymentChannel] : undefined;
  const ChannelIcon = channel?.icon;

  return (
    <>
    <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <span className="min-w-0 truncate">{metaParts(t, lookup, showDate).join(" · ")}</span>
      {ChannelIcon && channel && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0" aria-label={channel.label}>
              <ChannelIcon className="h-3.5 w-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{channel.label}</TooltipContent>
        </Tooltip>
      )}
      {bankCategory && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex min-w-0 max-w-[45%] shrink-0 cursor-help items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[11px]">
              <Sparkles className="h-3 w-3 shrink-0" />
              <span className="truncate">{bankCategory}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            Plaid&apos;s own guess at what this transaction is: {bankCategory}. It can help you pick a category, and is
            used as a suggestion when nothing else matches.
          </TooltipContent>
        </Tooltip>
      )}
    </div>
    {raw && <p className="truncate font-mono text-[11px] text-muted-foreground/80">{raw}</p>}
    </>
  );
}
