"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import useSWR from "swr";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { useBudgetHierarchy } from "@/hooks";
import { getTransactions } from "@/lib/db/client";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function BudgetItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = use(params);
  const id = parseInt(itemId, 10);
  const searchParams = useSearchParams();
  const now = new Date();
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth()), 10);

  const { formatAmount } = usePrivacy();
  const currency = useCurrency();
  const fmt = (n: number) => formatAmount(n, currency);

  const hierarchy = useBudgetHierarchy(true);
  const item = hierarchy?.items.find((i) => i.id === id);
  const sub = hierarchy?.subcategories.find((s) => s.id === item?.subcategoryId);
  const group = hierarchy?.groups.find((g) => g.id === sub?.groupId);

  const { start, end } = useMemo(
    () => ({ start: new Date(year, month, 1), end: new Date(year, month + 1, 0, 23, 59, 59) }),
    [year, month]
  );

  const { data: transactions } = useSWR(
    `budget-item-tx/${id}/${year}/${month}`,
    () => getTransactions({ budgetItemId: id, startDate: start, endDate: end }),
    { revalidateOnFocus: true }
  );

  const total = transactions?.reduce((a, t) => a + (t.amountOut - t.amountIn), 0) ?? 0;

  return (
    <div className="space-y-5 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/budget?year=${year}&month=${month}`}>Budget</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {group && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>{group.name}</BreadcrumbItem>
            </>
          )}
          {sub && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>{sub.name}</BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{item?.name ?? "Item"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{item?.name ?? "Item"}</h1>
          <p className="text-sm text-muted-foreground">
            {MONTH_NAMES[month]} {year} · {transactions?.length ?? 0} transaction(s)
          </p>
        </div>
        <span className="text-xl font-semibold tabular-nums">{fmt(total)}</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {!transactions ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : transactions.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No transactions this month.</p>
          ) : (
            <ul className="divide-y">
              {transactions.map((t) => {
                const net = t.amountOut - t.amountIn;
                return (
                  <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{t.description}</p>
                      <p className="text-xs text-muted-foreground">{format(t.date, "MMM d, yyyy")}</p>
                    </div>
                    <span className={cn("shrink-0 text-sm tabular-nums", net < 0 && "text-primary")}>
                      {net < 0 ? `+${fmt(Math.abs(net))}` : fmt(net)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
