"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePrivacy } from "@/contexts/privacy-context";
import { useCurrency } from "@/contexts/settings-context";
import { updateProject } from "@/hooks/use-projects";
import type { ProjectSummary } from "@/lib/projects/types";
import { ProjectDialog } from "./project-dialog";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { formatProjectRange } from "./project-utils";

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const { formatAmount } = usePrivacy();
  const currency = useCurrency();
  const fmt = (n: number) => formatAmount(n, currency, false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const pct = project.budget ? Math.min(100, (project.spent / project.budget) * 100) : 0;
  const over = project.budget != null && project.spent > project.budget;

  const toggleArchive = async () => {
    try {
      await updateProject(project.id, { isArchived: !project.isArchived });
      toast.success(project.isArchived ? "Project restored" : "Project archived");
    } catch {
      toast.error("Failed to update project");
    }
  };

  return (
    // The title link stretches over the whole card (after:inset-0), so a click
    // anywhere opens the project; the actions menu sits above it.
    <Card className="relative flex h-full flex-col transition-colors hover:border-primary/40">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <Link
            href={`/projects/${project.id}`}
            className="flex items-center gap-2 text-base font-medium after:absolute after:inset-0 after:rounded-[inherit] hover:underline"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
            <span className="truncate">{project.name}</span>
          </Link>
          <p className="text-xs text-muted-foreground">{formatProjectRange(project.startDate, project.endDate)}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative z-10 -mr-2 -mt-1 h-7 w-7 shrink-0" aria-label="Project actions">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={toggleArchive}>{project.isArchived ? "Restore" : "Archive"}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="mt-auto space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-semibold tabular-nums">{fmt(project.spent)}</span>
          {project.budget != null && (
            <span className={cn("text-xs tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
              of {fmt(project.budget)}
            </span>
          )}
        </div>
        {project.budget != null && (
          <Progress value={pct} className={cn("h-1.5", over && "[&_[data-slot=progress-indicator]]:bg-destructive")} />
        )}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {project.fundedSeparately && (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              Funded separately
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {project.transactionCount} transaction{project.transactionCount === 1 ? "" : "s"}
          </span>
        </div>
      </CardContent>

      <ProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
      <DeleteProjectDialog project={project} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </Card>
  );
}
