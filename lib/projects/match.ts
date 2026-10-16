/**
 * Project keywords on import. A keyword only counts when the transaction's
 * day falls inside the project window, so "TOKYO" tags the trip and nothing
 * from other years. More than one matching project leaves the row unassigned
 * (suggestions on the project page pick it up instead).
 */

import { matchesKeyword } from "@/lib/categories/keyword";
import type { ProjectSummary } from "./types";

type MatchableProject = Pick<ProjectSummary, "id" | "keywords" | "startDate" | "endDate" | "isArchived">;

/** Local YYYY-MM-DD, matching how imported dates are shown to the user. */
function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function matchProject(matchField: string, date: Date, projects: MatchableProject[]): number | null {
  const day = localDay(date);
  const hits = projects.filter(
    (p) =>
      !p.isArchived &&
      p.keywords.length > 0 &&
      day >= p.startDate &&
      (!p.endDate || day <= p.endDate) &&
      p.keywords.some((k) => matchesKeyword(matchField, k))
  );
  return hits.length === 1 ? hits[0].id : null;
}
