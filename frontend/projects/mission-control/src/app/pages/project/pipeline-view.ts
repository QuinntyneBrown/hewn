import { DirectionStatus, ProjectStatus } from '@hewn/api';
import { StatusName } from '@hewn/components';

/** Stage duration as the mocks show it: `0:41`, `48:30`, `3:12:48`; a running stage counts up to `now`. */
export function formatDuration(
  startedAt: string | null,
  endedAt: string | null,
  now: number,
): string {
  if (!startedAt) {
    return '—';
  }

  const total = Math.max(
    0,
    Math.floor(((endedAt ? Date.parse(endedAt) : now) - Date.parse(startedAt)) / 1000),
  );
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/**
 * The status pill beside the project name. It follows the current direction, as the mocks do (a queued
 * direction reads Running, a finished one Complete), except that a Blocked project always reads Blocked.
 */
export function headerStatus(
  project: ProjectStatus,
  direction: DirectionStatus | null,
): StatusName {
  if (project === 'Blocked' || direction === null) {
    return project;
  }

  return direction === 'Queued' ? 'Running' : direction;
}
