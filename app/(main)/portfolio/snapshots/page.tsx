"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  History,
  ClockPlus,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { RowGroup } from "@/components/ui/section";
import { EditSnapshotDialog } from "@/components/features/portfolio";
import {
  usePortfolioSnapshotsPage,
  deletePortfolioSnapshot,
  invalidatePortfolio,
  type DbPortfolioSnapshot,
} from "@/hooks/use-database";
import { useCurrency, useTimezone } from "@/contexts/settings-context";
import { usePrivacy } from "@/contexts/privacy-context";
import { formatDateTime } from "@/lib/utils/formatters";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PAGE_SIZE = 50;

export default function SnapshotHistoryPage() {
  const [page, setPage] = useState(0);
  const [editingSnapshot, setEditingSnapshot] = useState<DbPortfolioSnapshot | null>(null);
  const [isSnapshotting, setIsSnapshotting] = useState(false);

  const userCurrency = useCurrency();
  const userTimezone = useTimezone();
  const { formatAmount } = usePrivacy();

  const sentinelRef = useSetPageHeader("Snapshot History");
  const { snapshots, total, isLoading } = usePortfolioSnapshotsPage(page, PAGE_SIZE);

  const handleTakeSnapshot = useCallback(async () => {
    setIsSnapshotting(true);
    try {
      const res = await fetch("/api/portfolio/snapshots/today", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      invalidatePortfolio();
      toast.success(data.action === "updated" ? "Snapshot updated" : "Snapshot created");
    } catch {
      toast.error("Failed to take snapshot");
    } finally {
      setIsSnapshotting(false);
    }
  }, []);

  const handleDeleteSnapshot = useCallback(async (snapshot: DbPortfolioSnapshot) => {
    try {
      await deletePortfolioSnapshot(snapshot.id!);

      toast.success("Snapshot deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              const res = await fetch("/api/portfolio/snapshots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  date: snapshot.date.toISOString(),
                  totalSavings: snapshot.totalSavings,
                  totalInvestments: snapshot.totalInvestments,
                  totalAssets: snapshot.totalAssets,
                  totalDebt: snapshot.totalDebt,
                  netWorth: snapshot.netWorth,
                  details: snapshot.details,
                }),
              });
              if (!res.ok) throw new Error("Failed to restore");
              invalidatePortfolio();
              toast.success("Snapshot restored");
            } catch {
              toast.error("Failed to restore snapshot");
            }
          },
        },
        actionButtonStyle: { backgroundColor: "#16a34a", color: "white" },
      });
    } catch (error) {
      toast.error("Failed to delete snapshot");
      console.error(error);
    }
  }, []);

  const totalPages = total != null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : undefined;
  const rangeStart = total != null && total > 0 ? page * PAGE_SIZE + 1 : 0;
  const rangeEnd = total != null ? Math.min(total, (page + 1) * PAGE_SIZE) : undefined;

  // Page numbers to render: 1, 2 ... second-last, last, with ellipses as needed
  const pageItems: Array<number | "ellipsis"> = useMemo(() => {
    if (!totalPages) return [];
    const current = page + 1; // 1-indexed
    const pages = new Set<number>([1, 2, totalPages - 1, totalPages, current, current - 1, current + 1]);
    const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

    const items: Array<number | "ellipsis"> = [];
    let prev: number | undefined;
    for (const p of sorted) {
      if (prev != null && p - prev > 1) items.push("ellipsis");
      items.push(p);
      prev = p;
    }
    return items;
  }, [page, totalPages]);

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
              <BreadcrumbPage>Snapshot History</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Snapshot History</h1>
            <p className="text-muted-foreground">
              {total != null
                ? `${total} snapshot${total !== 1 ? "s" : ""} of your net worth over time`
                : "Net worth snapshots over time"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleTakeSnapshot}
            disabled={isSnapshotting}
          >
            <ClockPlus className={cn("h-4 w-4", isSnapshotting && "animate-pulse")} />
            Take Snapshot
          </Button>
        </div>
        <div ref={sentinelRef} className="h-0" />
      </div>

      {/* Content */}
      {isLoading && !snapshots ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !snapshots || snapshots.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">No snapshots yet</p>
          <p className="text-sm mt-1">
            Snapshots are automatically saved when you visit the portfolio page.
          </p>
        </div>
      ) : (
        <>
          <RowGroup>
            {snapshots.map((snapshot) => {
              return (
                <div key={snapshot.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex w-9 shrink-0 justify-center">
                    <IconBadge>
                      <History className="h-4 w-4 text-muted-foreground" />
                    </IconBadge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {formatDateTime(snapshot.createdAt, userTimezone)}
                    </p>
                    <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="text-emerald-500">
                        Savings: {formatAmount(snapshot.totalSavings, userCurrency, false)}
                      </span>
                      <span className="text-blue-500">
                        Inv: {formatAmount(snapshot.totalInvestments, userCurrency, false)}
                      </span>
                      <span className="text-amber-500">
                        Assets: {formatAmount(snapshot.totalAssets, userCurrency, false)}
                      </span>
                      <span className="text-red-500">
                        Debt: {formatAmount(snapshot.totalDebt, userCurrency, false)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold tabular-nums shrink-0">
                    {formatAmount(snapshot.netWorth, userCurrency)}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setEditingSnapshot(snapshot)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteSnapshot(snapshot)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </RowGroup>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total != null ? `Showing ${rangeStart}–${rangeEnd} of ${total}` : null}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {pageItems.map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`ellipsis-${idx}`} className="px-1.5 text-sm text-muted-foreground">
                    …
                  </span>
                ) : (
                  <Button
                    key={item}
                    variant={item === page + 1 ? "default" : "outline"}
                    size="sm"
                    className="w-9 px-0"
                    onClick={() => setPage(item - 1)}
                  >
                    {item}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => p + 1)}
                disabled={totalPages != null && page >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Edit Snapshot Dialog */}
      {editingSnapshot && (
        <EditSnapshotDialog
          open={!!editingSnapshot}
          onOpenChange={(open) => !open && setEditingSnapshot(null)}
          snapshot={editingSnapshot}
        />
      )}
    </div>
  );
}
