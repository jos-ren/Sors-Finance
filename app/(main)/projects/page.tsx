"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSetPageHeader } from "@/contexts/page-header-context";
import { useProjects } from "@/hooks/use-projects";
import { ProjectCard } from "@/components/features/projects/project-card";
import { ProjectDialog } from "@/components/features/projects/project-dialog";
import { STATUS_LABELS } from "@/components/features/projects/project-utils";
import type { ProjectStatus } from "@/lib/db/types";
import type { ProjectSummary } from "@/lib/projects/types";

const SECTIONS: ProjectStatus[] = ["active", "upcoming", "done"];

export default function ProjectsPage() {
  const router = useRouter();
  const sentinelRef = useSetPageHeader("Projects");
  const projects = useProjects();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { byStatus, archived } = useMemo(() => {
    const byStatus: Record<ProjectStatus, ProjectSummary[]> = { active: [], upcoming: [], done: [] };
    const archived: ProjectSummary[] = [];
    for (const p of projects ?? []) {
      if (p.isArchived) archived.push(p);
      else byStatus[p.status].push(p);
    }
    // Upcoming reads soonest first; the API sorts newest start first
    byStatus.upcoming.reverse();
    return { byStatus, archived };
  }, [projects]);

  return (
    <div className="space-y-6 p-6">
      <div ref={sentinelRef} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Trips, moves and big purchases, with every transaction in one place.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {!projects ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyProjects onCreate={() => setDialogOpen(true)} />
      ) : (
        <>
          {SECTIONS.map(
            (status) =>
              byStatus[status].length > 0 && (
                <section key={status} className="space-y-3">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {STATUS_LABELS[status]} ({byStatus[status].length})
                  </h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {byStatus[status].map((p) => (
                      <ProjectCard key={p.id} project={p} />
                    ))}
                  </div>
                </section>
              )
          )}

          {archived.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]:-rotate-90" />
                Archived ({archived.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {archived.map((p) => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => router.push(`/projects/${id}`)}
      />
    </div>
  );
}

function EmptyProjects({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <FolderKanban className="h-8 w-8 text-muted-foreground" />
      <p className="text-lg font-medium">No projects yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        A project groups the transactions from a trip, a move or a big purchase, across categories and months, so you
        can see what it really cost.
      </p>
      <Button onClick={onCreate}>Create a project</Button>
    </div>
  );
}
