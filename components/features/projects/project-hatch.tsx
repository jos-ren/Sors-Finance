/**
 * Diagonal-stripe fills in a project's colour, for chart segments that are
 * project spending (funded separately, not judged against the budget).
 * Render the patterns inside a Recharts chart's <defs> and fill with
 * `url(#…)`. Pattern ids are document-global, so each chart passes a prefix.
 */

export const projectHatchId = (prefix: string, projectId: number) => `${prefix}-project-hatch-${projectId}`;

export const projectHatchFill = (prefix: string, projectId: number) => `url(#${projectHatchId(prefix, projectId)})`;

export function projectHatchPattern(prefix: string, project: { id: number; color: string }) {
  return (
    <pattern
      key={project.id}
      id={projectHatchId(prefix, project.id)}
      patternUnits="userSpaceOnUse"
      width={6}
      height={6}
      patternTransform="rotate(45)"
    >
      <rect width={6} height={6} fill={project.color} fillOpacity={0.2} />
      <line x1={0} y1={0} x2={0} y2={6} stroke={project.color} strokeWidth={3} strokeOpacity={0.85} />
    </pattern>
  );
}
