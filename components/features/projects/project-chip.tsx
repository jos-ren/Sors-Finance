import Link from "next/link";
import { cn } from "@/lib/utils";

/** Small coloured project label that links to the project. */
export function ProjectChip({
  id,
  name,
  color,
  className,
}: {
  id: number;
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <Link
      href={`/projects/${id}`}
      className={cn(
        "inline-flex max-w-[160px] items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs hover:bg-accent",
        className
      )}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{name}</span>
    </Link>
  );
}
