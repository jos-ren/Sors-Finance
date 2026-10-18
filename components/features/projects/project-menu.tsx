"use client";

import Link from "next/link";
import { ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/projects/types";

/**
 * Project control for a transaction row, shaped like the category picker: the
 * project's colour dot and name, or a faint dashed "+ Project". Fixed width so
 * the row never shifts; below 1100px it shrinks to the dot (or a plus).
 */
export function ProjectMenu({
  projects,
  currentId,
  onSelect,
  disabled,
}: {
  projects: ProjectSummary[];
  currentId: number | null;
  onSelect: (projectId: number | null) => void;
  disabled?: boolean;
}) {
  const current = currentId != null ? projects.find((p) => p.id === currentId) : undefined;
  const choices = projects.filter((p) => !p.isArchived);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={current ? `Project: ${current.name}` : "Add to a project"}
        title={current?.name}
        className={cn(
          "inline-flex w-[116px] shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-50 max-[1100px]:w-8 max-[1100px]:justify-center max-[1100px]:px-0",
          !current && "border-dashed text-muted-foreground/60 hover:text-foreground"
        )}
      >
        {current ? (
          <>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: current.color }} />
            <span className="min-w-0 flex-1 truncate text-left max-[1100px]:hidden">{current.name}</span>
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50 max-[1100px]:hidden" />
          </>
        ) : (
          <>
            <Plus className="h-3 w-3 shrink-0" />
            <span className="max-[1100px]:hidden">Project</span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {choices.length === 0 && <DropdownMenuItem disabled>No projects yet</DropdownMenuItem>}
        {choices.map((p) => (
          <DropdownMenuItem key={p.id} disabled={p.id === currentId} onClick={() => onSelect(p.id)}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}
          </DropdownMenuItem>
        ))}
        {current && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/projects/${current.id}`}>View project</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSelect(null)}>Remove from project</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
