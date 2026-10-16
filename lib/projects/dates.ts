/**
 * Project date windows. Projects store whole days (UTC midnight) and travel
 * over the API as YYYY-MM-DD. A window is [start, end + 1 day); an open-ended
 * project runs until today.
 */

import type { ProjectStatus } from "@/lib/db/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Date → YYYY-MM-DD (UTC). */
export function toDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** YYYY-MM-DD → Date at UTC midnight, or null when invalid. */
export function parseDayString(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Exclusive end of a project window. Open-ended projects end after today. */
export function windowEnd(endDate: Date | null | undefined, now: Date = new Date()): Date {
  const last = endDate ?? new Date(`${toDayString(now)}T00:00:00.000Z`);
  return new Date(last.getTime() + DAY_MS);
}

export function isInWindow(
  date: Date,
  startDate: Date,
  endDate: Date | null | undefined,
  now: Date = new Date()
): boolean {
  const t = date.getTime();
  return t >= startDate.getTime() && t < windowEnd(endDate, now).getTime();
}

export function projectStatus(
  startDate: Date,
  endDate: Date | null | undefined,
  now: Date = new Date()
): ProjectStatus {
  const today = toDayString(now);
  if (today < toDayString(startDate)) return "upcoming";
  if (endDate && today > toDayString(endDate)) return "done";
  return "active";
}
