"use client";

import { use, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, MoreVertical, PencilLine, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { setTransactionsProject, updateProject, useProject } from "@/hooks/use-projects";
import { ProjectDialog } from "@/components/features/projects/project-dialog";
import { DeleteProjectDialog } from "@/components/features/projects/delete-project-dialog";
import { STATUS_LABELS, formatProjectRange } from "@/components/features/projects/project-utils";
import { TransactionListCard } from "@/components/features/transactions/transaction-list-card";
import { fromPickerValue, type PickerValue } from "@/components/features/budget/budget-item-picker";
import { useTransactions, updateTransaction } from "@/hooks";
import type { DbTransaction } from "@/lib/db/types";
import type { ProjectDetail } from "@/lib/projects/types";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const id = parseInt(projectId, 10);
  const router = useRouter();
  const sentinelRef = useSetPageHeader("Projects");
  const { project, error } = useProject(id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // A breakdown row opens that category's or month's transactions
  const openTransactions = (param: "category" | "month", key: string) =>
    router.push(`/projects/${id}/transactions?${param}=${encodeURIComponent(key)}`);

  const toggleArchive = async () => {
    if (!project) return;
    try {
      await updateProject(project.id, { isArchived: !project.isArchived });
      toast.success(project.isArchived ? "Project restored" : "Project archived");
    } catch {
      toast.error("Failed to update project");
    }
  };

  return (
    <div className="space-y-5 p-6">
      <div ref={sentinelRef} />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/projects">Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{project?.name ?? "Project"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {error ? (
        <p className="py-16 text-center text-sm text-muted-foreground">This project doesn&apos;t exist.</p>
      ) : !project ? (
        <DetailSkeleton />
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
                <span className="truncate">{project.name}</span>
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{formatProjectRange(project.startDate, project.endDate)}</span>
                <Badge variant="outline" className="font-normal">
                  {project.isArchived ? "Archived" : STATUS_LABELS[project.status]}
                </Badge>
                {project.fundedSeparately && (
                  <Badge variant="outline" className="font-normal">
                    Funded separately
                  </Badge>
                )}
              </div>
              {project.notes && <p className="text-sm text-muted-foreground">{project.notes}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
                <PencilLine className="h-4 w-4" />
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Project actions">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={toggleArchive}>
                    {project.isArchived ? "Restore" : "Archive"}
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <TotalCard project={project} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <BreakdownCard
              title="By category"
              description="What the money went on"
              rows={project.byCategory.map((c) => ({
                key: c.key,
                label: c.name,
                sub: c.groupName,
                amount: c.amount,
              }))}
              total={project.spent}
              color={project.color}
              onSelect={(r) => openTransactions("category", r.key)}
            />
            <BreakdownCard
              title="By month"
              description="When it was spent"
              rows={project.byMonth.map((m) => ({
                key: `${m.year}-${m.month}`,
                label: `${MONTH_NAMES[m.month]} ${m.year}`,
                sub: null,
                amount: m.amount,
              }))}
              total={project.spent}
              color={project.color}
              onSelect={(r) => openTransactions("month", r.key)}
            />
          </div>

          <TransactionsCard project={project} />

          {project.suggestions.length > 0 && <SuggestionsCard project={project} />}

          <ProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
          <DeleteProjectDialog
            project={project}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onDeleted={() => router.push("/projects")}
          />
        </>
      )}
    </div>
  );
}

function useFormat() {
  const { formatAmount } = usePrivacy();
  const currency = useCurrency();
  return (n: number) => formatAmount(n, currency, false);
}

function TotalCard({ project }: { project: ProjectDetail }) {
  const fmt = useFormat();
  const budget = project.budget;
  const over = budget != null && project.spent > budget;
  const pct = budget ? Math.min(100, (project.spent / budget) * 100) : 0;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Spent</p>
            <p className="text-3xl font-semibold tabular-nums">{fmt(project.spent)}</p>
          </div>
          {budget != null && (
            <p className={cn("text-sm tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
              {over ? `${fmt(project.spent - budget)} over` : `${fmt(budget - project.spent)} left`} of{" "}
              {fmt(budget)}
            </p>
          )}
        </div>
        {budget != null && (
          <Progress
            value={pct}
            className={cn("h-2", over && "[&_[data-slot=progress-indicator]]:bg-destructive")}
          />
        )}
        {project.fundCategoryId != null && project.fundSetAside != null && (
          <p className="border-t pt-3 text-sm text-muted-foreground">
            Set aside <span className="font-medium text-foreground tabular-nums">{fmt(project.fundSetAside)}</span> in{" "}
            {project.fundCategoryName ?? "the fund"}.{" "}
            {project.spent > project.fundSetAside
              ? `${fmt(project.spent - project.fundSetAside)} more than the fund.`
              : `${fmt(project.fundSetAside - project.spent)} still in the fund.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownCard({
  title,
  description,
  rows,
  total,
  color,
  onSelect,
}: {
  title: string;
  description: string;
  rows: { key: string; label: string; sub: string | null; amount: number }[];
  total: number;
  color: string;
  /** Opens the transactions behind a row. */
  onSelect: (row: { key: string; label: string }) => void;
}) {
  const fmt = useFormat();
  const max = Math.max(0, ...rows.map((r) => r.amount));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.key}>
              <button
                type="button"
                onClick={() => onSelect(r)}
                title="Show these transactions"
                className="group block w-full cursor-pointer space-y-1 text-left"
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="underline-offset-4 group-hover:underline">{r.label}</span>
                    {r.sub && <span className="ml-1.5 text-xs text-muted-foreground">{r.sub}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {fmt(r.amount)}
                    {total > 0 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {Math.round((r.amount / total) * 100)}%
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${max > 0 ? Math.max(0, (r.amount / max) * 100) : 0}%`, backgroundColor: color }}
                  />
                </div>
              </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Full transactions for the project's own rows and its suggestions, newest first.
 * The project detail only carries slim rows; the shared list needs the real ones.
 */
function useProjectRows(project: ProjectDetail) {
  const all = useTransactions();
  return useMemo(() => {
    if (!all) return { transactions: undefined, suggestions: undefined };
    const newestFirst = (a: DbTransaction, b: DbTransaction) =>
      b.date.getTime() - a.date.getTime() || (b.transactedAt?.getTime() ?? 0) - (a.transactedAt?.getTime() ?? 0);
    const suggestionIds = new Set(project.suggestions.map((s) => s.id));
    return {
      transactions: all.filter((t) => t.projectId === project.id).sort(newestFirst),
      suggestions: all.filter((t) => t.id != null && suggestionIds.has(t.id)).sort(newestFirst),
    };
  }, [all, project.id, project.suggestions]);
}

/** Recategorize a row from the list; locked so keyword re-matching never moves it back. */
function useRecategorize() {
  const [movingId, setMovingId] = useState<number | null>(null);
  const changeCategory = async (t: DbTransaction, value: PickerValue) => {
    if (!value || t.id == null) return;
    setMovingId(t.id);
    try {
      await updateTransaction(t.id, { ...fromPickerValue(value), categoryLocked: true });
      toast.success("Transaction recategorized");
    } catch {
      toast.error("Failed to recategorize transaction");
    } finally {
      setMovingId(null);
    }
  };
  return { movingId, changeCategory };
}

function SuggestionsCard({ project }: { project: ProjectDetail }) {
  const [busy, setBusy] = useState(false);
  const { suggestions } = useProjectRows(project);
  const { movingId, changeCategory } = useRecategorize();

  const add = async (ids: number[]) => {
    setBusy(true);
    try {
      await setTransactionsProject(ids, project.id);
      toast.success(ids.length === 1 ? "Added to project" : `Added ${ids.length} transactions`);
    } catch {
      toast.error("Failed to add to project");
    } finally {
      setBusy(false);
    }
  };

  return (
    <CollapsibleCard
      title={`Suggestions (${project.suggestions.length})`}
      description="Unassigned spending between the project dates. Add the ones that belong to this project."
      actions={
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => add(project.suggestions.map((s) => s.id))}
          className="shrink-0"
        >
          Add all
        </Button>
      }
    >
      <TransactionListCard
        embedded
        transactions={suggestions}
        emptyText="No suggestions."
        pickerPlaceholder="Category"
        movingId={movingId}
        onCategoryChange={changeCategory}
        rowAction={(t) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={busy}
            onClick={() => add([t.id!])}
            aria-label={`Add ${t.description} to project`}
            title="Add to project"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      />
    </CollapsibleCard>
  );
}

/** A card whose header toggles its body open and closed. The body grows with its content (no inner scrollbar). */
function CollapsibleCard({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        {/* CardHeader is a grid by default; `flex` replaces it so the buttons sit on the right */}
        <CardHeader className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="shrink-0"
                aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function TransactionsCard({ project }: { project: ProjectDetail }) {
  const [busy, setBusy] = useState(false);
  const { transactions } = useProjectRows(project);
  const { movingId, changeCategory } = useRecategorize();

  const remove = async (id: number) => {
    setBusy(true);
    try {
      await setTransactionsProject([id], null);
      toast.success("Removed from project");
    } catch {
      toast.error("Failed to remove from project");
    } finally {
      setBusy(false);
    }
  };

  return (
    <CollapsibleCard
      title={`Transactions (${project.transactions.length})`}
      description="Each one keeps its category. Removing it only takes it out of this project."
    >
      <TransactionListCard
        embedded
        hideProjectChip
        transactions={transactions}
        emptyText="No transactions yet. Add them from the suggestions below or from the Transactions page."
        pickerPlaceholder="Category"
        movingId={movingId}
        onCategoryChange={changeCategory}
        rowAction={(t) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            disabled={busy}
            onClick={() => remove(t.id!)}
            aria-label={`Remove ${t.description} from project`}
            title="Remove from project"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      />
    </CollapsibleCard>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-16 w-full max-w-md" />
      <Skeleton className="h-32 rounded-xl" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}
