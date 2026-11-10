import type { ProjectStatus, ProjectSummary } from '@hewn/api';

/** A status, or the Archived filter (L2-003 AC1), as `?status=` names it. */
export type ListFilter = ProjectStatus | 'Archived';

/** The statuses the filter offers, in the mock's order (L2-002 AC2); Archived follows them. */
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

/** The status or Archived in `?status=`, or null for All; anything else is ignored. */
export function parseStatusFilter(value: string | null): ListFilter | null {
  if (value?.toLowerCase() === 'archived') return 'Archived';
  return STATUS_FILTERS.find((s) => s.toLowerCase() === value?.toLowerCase()) ?? null;
}

export function countByStatus(rows: readonly ProjectSummary[]): Record<ProjectStatus, number> {
  const counts = Object.fromEntries(STATUS_FILTERS.map((s) => [s, 0])) as Record<
    ProjectStatus,
    number
  >;
  for (const r of rows) if (!r.archived) counts[r.status]++;
  return counts;
}

/** Archived projects show only under Archived; All and each status leave them out (L2-003 AC1). */
export function withStatus(
  rows: readonly ProjectSummary[],
  filter: ListFilter | null,
): ProjectSummary[] {
  if (filter === 'Archived') return rows.filter((r) => r.archived);
  return rows.filter((r) => !r.archived && (filter === null || r.status === filter));
}

/** A project with a running, paused or blocked direction can't be archived (L2-003 AC2). */
export function canArchive(row: ProjectSummary): boolean {
  return !row.archived && !['Running', 'Paused', 'Blocked'].includes(row.status);
}

/** Why archiving or restoring didn't happen: the API's reason, else what went wrong. */
export function archiveRefusal(status: number, title: string | null): string {
  if (title) return `${title}.`;
  if (status === 403) return 'Only an Owner can archive or restore a project.';
  return `The Hewn API returned ${status || 'no response'}. Try again.`;
}

/** The delete dialog's field error (L2-003 AC3): nothing until something different from the name is typed. */
export function confirmNameError(typed: string, name: string): string | null {
  return typed === '' || typed === name ? null : `Type ${name} exactly to delete it.`;
}

/** Why a project wasn't deleted, for the delete dialog's danger callout. */
export function deleteFailure(status: number, title: string | null): string {
  if (status === 409 && title) return `${title}. Nothing was removed.`;
  if (status === 403) return 'Only an Owner can delete a project. Nothing was removed.';
  return `The API returned ${status || 'no response'}. Nothing was removed; try again.`;
}

const shortDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** "4s ago", "18m ago", "2h ago", "Yesterday", "3 days ago", then "12 Oct" after a week, as the Projects mocks show activity. */
export function lastActivityText(at: string, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - Date.parse(at)) / 1000));
  if (seconds < 1) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  if (seconds < 2 * 86_400) return 'Yesterday';
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)} days ago`;
  return shortDate.format(new Date(at));
}
