"use client";

import { useMemo } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/hooks/use-projects";

const NONE = "none";

/**
 * Pick a project for a transaction. Active and upcoming projects come first;
 * done projects follow; archived ones are hidden unless already selected.
 */
export function ProjectSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: number | null;
  onChange: (projectId: number | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const projects = useProjects();
  const { current, done } = useMemo(() => {
    const visible = (projects ?? []).filter((p) => !p.isArchived || p.id === value);
    return {
      current: visible.filter((p) => p.status !== "done"),
      done: visible.filter((p) => p.status === "done"),
    };
  }, [projects, value]);

  return (
    <Select
      value={value != null ? String(value) : NONE}
      onValueChange={(v) => onChange(v === NONE ? null : Number(v))}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="No project" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No project</SelectItem>
        {current.length > 0 && (
          <SelectGroup>
            <SelectLabel>Active and upcoming</SelectLabel>
            {current.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {done.length > 0 && (
          <SelectGroup>
            <SelectLabel>Done</SelectLabel>
            {done.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
