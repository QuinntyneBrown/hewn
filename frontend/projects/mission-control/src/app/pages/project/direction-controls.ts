/** Pause, resume and what the project header shows for them (L2-029 AC1, AC2, AC5). */

/** The reason Hewn records when an Owner pauses a direction. */
export const PAUSED_BY_OWNER = 'Paused by an Owner';

export type DirectionControl = 'pause' | 'pausing' | 'resume';

/**
 * Which control the header offers Owners: Pause on a running direction, Pausing… while the step in progress
 * finishes, Resume on a direction an Owner paused. A direction paused at its budget continues with Raise and
 * resume instead, so it gets neither.
 */
export function directionControl(d: {
  status: string;
  pauseReason: string | null;
  pauseRequested: boolean;
}): DirectionControl | null {
  if (d.status === 'Running') return d.pauseRequested ? 'pausing' : 'pause';
  if (d.status === 'Paused' && d.pauseReason === PAUSED_BY_OWNER) return 'resume';
  return null;
}

/** "Paused by quinntynebrown at 14:29", as the paused mock's callout reads. */
export function pausedTitle(
  pausedBy: string | null,
  pausedAt: string | null,
  timeZone?: string,
): string {
  if (!pausedBy || !pausedAt) return 'Paused';
  const time = new Date(pausedAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
  return `Paused by ${pausedBy} at ${time}`;
}

/** What a failed Pause or Resume says. A 409 means the direction moved on; anything else changed nothing. */
export function controlFailure(action: 'pause' | 'resume', status: number): string {
  const name = action === 'pause' ? 'Pause' : 'Resume';
  if (status === 409) {
    return `${name} wasn’t applied: the direction changed a moment ago. The page shows where it is now.`;
  }
  return `${name} didn’t reach Hewn (${status || 'no response'}). The direction is unchanged; try again.`;
}
