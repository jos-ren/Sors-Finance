"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import type { HomeSummary } from "@/lib/budget/home-types";
import { usePlaidReconnectNeeded } from "@/hooks";

function Chip({ href, children, tone = "default" }: { href: string; children: React.ReactNode; tone?: "default" | "warn" }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted",
        tone === "warn" && "border-red-500/50 bg-red-500/10 text-red-600 hover:bg-red-500/15 dark:text-red-400"
      )}
    >
      {children}
    </Link>
  );
}

/** Things to act on: banks to reconnect, uncategorized/pending transactions, overspent categories, bills due soon. */
export function AttentionStrip({ summary }: { summary: HomeSummary }) {
  const { formatAmount } = usePrivacy();
  const currency = useCurrency();
  const { attention, bills, year, month } = summary;
  const reconnectNeeded = usePlaidReconnectNeeded();
  const categoryHref = (id: number) => `/budget/category/${id}?year=${year}&month=${month}`;
  const dayLabel = (day: number) => new Date(year, month, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const hasItems =
    attention.uncategorized > 0 ||
    attention.pendingReview > 0 ||
    attention.overspent.length > 0 ||
    bills.dueSoon.length > 0 ||
    reconnectNeeded.length > 0;

  if (!hasItems) return null;

  return (
    <Card className="flex flex-row flex-wrap items-center gap-2 px-4 py-3">
      <span className="mr-2 text-sm font-medium">Needs attention</span>
      {reconnectNeeded.map((bank) => (
        <Chip key={`bank-${bank.id}`} href="/settings/plaid" tone="warn">
          {bank.institutionName} needs reconnecting
        </Chip>
      ))}
      {attention.pendingReview > 0 && <Chip href="/transactions">{attention.pendingReview} to review</Chip>}
      {attention.uncategorized > 0 && <Chip href="/transactions">{attention.uncategorized} uncategorized</Chip>}
      {attention.overspent.map((o) => (
        <Chip key={`over-${o.categoryId}`} href={categoryHref(o.categoryId)} tone="warn">
          {o.name} over by {formatAmount(o.over, currency, false)}
        </Chip>
      ))}
      {bills.dueSoon.map((b) => (
        <Chip key={`bill-${b.categoryId}`} href={categoryHref(b.categoryId)} tone={b.overdue ? "warn" : "default"}>
          {b.name} {b.overdue ? "expected" : "due"} {dayLabel(b.expectedDay)}
        </Chip>
      ))}
    </Card>
  );
}
