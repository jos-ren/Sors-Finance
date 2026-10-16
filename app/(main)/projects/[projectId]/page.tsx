"use client";

import { use, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { MoreVertical, PencilLine, Plus, X } from "lucide-react";
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
import type { ProjectDetail, ProjectTransaction } from "@/lib/projects/types";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const id = parseInt(projectId, 10);
  const router = useRouter();
  const sentinelRef = useSetPageHeader("Projects");
  const { project, error } = useProject(id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
            />
          </div>

          {project.suggestions.length > 0 && <SuggestionsCard project={project} />}

          <TransactionsCard project={project} />

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
}: {
  title: string;
  description: string;
  rows: { key: string; label: string; sub: string | null; amount: number }[];
  total: number;
  color: string;
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
              <li key={r.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {r.label}
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
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TransactionRow({
  t,
  action,
}: {
  t: ProjectTransaction;
  action: ReactNode;
}) {
  const fmt = useFormat();
  const net = t.amountOut - t.amountIn;
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm">{t.description}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(t.date), "MMM d, yyyy")} · {t.categoryName}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={cn("text-sm tabular-nums", net < 0 && "text-primary")}>
          {net < 0 ? `+${fmt(Math.abs(net))}` : fmt(net)}
        </span>
        {action}
      </div>
    </li>
  );
}

function SuggestionsCard({ project }: { project: ProjectDetail }) {
  const [busy, setBusy] = useState(false);

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
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Suggestions ({project.suggestions.length})</CardTitle>
          <CardDescription>
            Unassigned spending between the project dates. Add the ones that belong to this project.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => add(project.suggestions.map((s) => s.id))}
          className="shrink-0"
        >
          Add all
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="max-h-[420px] divide-y overflow-y-auto border-t">
          {project.suggestions.map((t) => (
            <TransactionRow
              key={t.id}
              t={t}
              action={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={busy}
                  onClick={() => add([t.id])}
                  aria-label={`Add ${t.description} to project`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              }
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function TransactionsCard({ project }: { project: ProjectDetail }) {
  const [busy, setBusy] = useState(false);

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
    <Card>
      <CardHeader>
        <CardTitle>Transactions ({project.transactions.length})</CardTitle>
        <CardDescription>Each one keeps its category. Removing it only takes it out of this project.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {project.transactions.length === 0 ? (
          <p className="border-t p-8 text-center text-sm text-muted-foreground">
            No transactions yet. Add them from the suggestions above or from the Transactions page.
          </p>
        ) : (
          <ul className="divide-y border-t">
            {project.transactions.map((t) => (
              <TransactionRow
                key={t.id}
                t={t}
                action={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    disabled={busy}
                    onClick={() => remove(t.id)}
                    aria-label={`Remove ${t.description} from project`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                }
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
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
