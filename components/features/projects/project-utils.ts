/**
 * Shared helpers for project UI. Project dates are YYYY-MM-DD strings; the
 * date picker works in local Dates, so convert at the edges.
 */

import { format } from "date-fns";
import type { ProjectStatus } from "@/lib/db/types";

export const PROJECT_COLORS = [
  "#84cc16", // lime
  "#0ea5e9", // sky
  "#f97316", // orange
  "#a855f7", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#eab308", // yellow
  "#ef4444", // red
];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  upcoming: "Upcoming",
  done: "Done",
};

export function dayToLocalDate(day: string | null | undefined): Date | undefined {
  if (!day) return undefined;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function localDateToDay(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** "Jan 1 – Apr 30, 2026", "Jun 6 – 8, 2025", "From Mar 3, 2027" */
export function formatProjectRange(startDate: string, endDate: string | null): string {
  const start = dayToLocalDate(startDate)!;
  if (!endDate) return `From ${format(start, "MMM d, yyyy")}`;
  const end = dayToLocalDate(endDate)!;
  if (start.getFullYear() !== end.getFullYear()) {
    return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
  }
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`;
  }
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}
