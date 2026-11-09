import type { ProjectStatus, ProjectSummary } from '@hewn/api';

/** The statuses the filter offers, in the mock's order (L2-002 AC2). */
export const STATUS_FILTERS: readonly ProjectStatus[] = [
  'Running',
  'Paused',
  'Blocked',
  'Idle',
  'Complete',
  'Cancelled',
];

/** Newest activity first (L2-002 AC1). */
export function byActivity(rows: readonly ProjectSummary[]): ProjectSummary[] {
  return [...rows].sort(
    (a, b) =>
      Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt) || a.name.localeCompare(b.name),
  );
}

/** Applies a live row: replaces the project's row, or adds a project not seen yet (L2-002 AC4). */
export function upsertRow(rows: readonly ProjectSummary[], row: ProjectSummary): ProjectSummary[] {
  return byActivity([...rows.filter((r) => r.id !== row.id), row]);
}

/** The status in `?status=`, or null for All; anything else is ignored. */
export function parseStatusFilter(value: string | null): ProjectStatus | null {
  return STATUS_FILTERS.find((s) => s.toLowerCase() === value?.toLowerCase()) ?? null;
}

export function countByStatus(rows: readonly ProjectSummary[]): Record<ProjectStatus, number> {
  const counts = Object.fromEntries(STATUS_FILTERS.map((s) => [s, 0])) as Record<
    ProjectStatus,
    number
  >;
  for (const r of rows) counts[r.status]++;
  return counts;
}

export function withStatus(
  rows: readonly ProjectSummary[],
  status: ProjectStatus | null,
): ProjectSummary[] {
  return status ? rows.filter((r) => r.status === status) : [...rows];
}

/** "4s ago", "18m ago", "2h ago", "Yesterday", "3 days ago", as the Projects mock shows activity. */
export function lastActivityText(at: string, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - Date.parse(at)) / 1000));
  if (seconds < 1) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  if (seconds < 2 * 86_400) return 'Yesterday';
  return `${Math.floor(seconds / 86_400)} days ago`;
}
