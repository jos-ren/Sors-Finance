"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ScrollText,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { cn } from "@/lib/utils";
import {
  SettingsBreadcrumb,
  SettingsPageHeader,
  RowGroup,
} from "@/components/features/settings/settings-shared";

const PAGE_SIZE = 25;

interface SystemLog {
  id: number;
  level: "info" | "warning" | "error";
  source: string;
  message: string;
  details: Record<string, unknown> | null;
  userId: number | null;
  createdAt: string;
}

const SOURCE_LABELS: Record<string, string> = {
  scheduler: "Scheduler",
  plaid_sync: "Plaid Sync",
  price_refresh: "Price Refresh",
  snapshot: "Snapshot",
  currency_cache: "Currency Cache",
};

const LEVEL_FILTERS = [
  { value: "", label: "All" },
  { value: "error", label: "Errors" },
  { value: "warning", label: "Warnings" },
  { value: "info", label: "Info" },
] as const;

function LevelIcon({ level }: { level: SystemLog["level"] }) {
  if (level === "error") {
    return <AlertCircle className="h-4 w-4 text-destructive" />;
  }
  if (level === "warning") {
    return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  }
  return <Info className="h-4 w-4 text-blue-500" />;
}

function LogRow({ log }: { log: SystemLog }) {
  const [open, setOpen] = useState(false);
  const hasDetails = log.details && Object.keys(log.details).length > 0;
  const createdAt = new Date(log.createdAt);

  const row = (
    <div
      className={cn(
        "flex items-start gap-3 p-4",
        hasDetails && "cursor-pointer transition-colors hover:bg-muted/40"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          log.level === "error"
            ? "bg-destructive/10"
            : log.level === "warning"
              ? "bg-amber-500/10"
              : "bg-blue-500/10"
        )}
      >
        <LevelIcon level={log.level} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{log.message}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {SOURCE_LABELS[log.source] || log.source}
          {" · "}
          <span title={format(createdAt, "PPpp")}>
            {formatDistanceToNow(createdAt, { addSuffix: true })}
          </span>
        </p>
      </div>
      {hasDetails && (
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground mt-2 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      )}
    </div>
  );

  if (!hasDetails) return row;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>{row}</CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t bg-muted/40 px-4 py-3">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all font-mono">
            {JSON.stringify(log.details, null, 2)}
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ErrorLogPage() {
  const sentinelRef = useSetPageHeader("Error Logs");

  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [levelFilter, setLevelFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const loadLogs = useCallback(async (targetPage: number, level: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      });
      if (level) params.set("level", level);

      const res = await fetch(`/api/system-logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      const { data } = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to load error log:", err);
      toast.error("Failed to load error log");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs(page, levelFilter);
  }, [page, levelFilter, loadLogs]);

  const handleFilterChange = (level: string) => {
    setLevelFilter(level);
    setPage(1);
  };

  const handleClear = async () => {
    setIsClearing(true);
    try {
      const res = await fetch("/api/system-logs", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear logs");
      toast.success("Error log cleared");
      setPage(1);
      await loadLogs(1, levelFilter);
    } catch {
      toast.error("Failed to clear error log");
    } finally {
      setIsClearing(false);
      setShowClearDialog(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="p-6 space-y-8">
      <div ref={sentinelRef} className="h-0" />

      <SettingsBreadcrumb page="Error Logs" />

      <SettingsPageHeader
        title="Error Logs"
        description="Review scheduled snapshot runs and any sync or integration failures."
        action={
          total > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearDialog(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear log
            </Button>
          ) : undefined
        }
      />

      {/* Level filter */}
      <div className="flex items-center gap-1.5">
        {LEVEL_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={levelFilter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading log entries...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mt-1">
            {levelFilter ? "No matching log entries" : "No log entries yet"}
          </p>
          <p className="text-xs text-muted-foreground max-w-sm">
            {levelFilter
              ? "Try a different filter to see other entries."
              : "Scheduled snapshot runs and any sync failures will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <RowGroup>
            {logs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </RowGroup>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {rangeStart}–{rangeEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clear confirmation dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the error log?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all log entries. New entries will still
              be recorded on future scheduled runs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleClear}
              disabled={isClearing}
            >
              {isClearing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Clear log"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
