import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Small coloured project label that links to the project. `compact` shows only
 * the colour dot and expands to the name on hover or keyboard focus, for long
 * lists where repeating the name on every row is noise.
 */
export function ProjectChip({
  id,
  name,
  color,
  className,
  compact = false,
}: {
  id: number;
  name: string;
  color: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/projects/${id}`}
      title={name}
      aria-label={`Project: ${name}`}
      className={cn(
        "group/chip inline-flex max-w-[160px] shrink-0 items-center rounded-sm border px-2 py-0.5 text-xs hover:bg-accent",
        !compact && "gap-1.5",
        className
      )}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {compact ? (
        <span className="max-w-0 overflow-hidden whitespace-nowrap transition-[max-width] duration-200 group-hover/chip:max-w-[130px] group-focus-visible/chip:max-w-[130px]">
          <span className="block truncate pl-1.5">{name}</span>
        </span>
      ) : (
        <span className="truncate">{name}</span>
      )}
    </Link>
  );
}
