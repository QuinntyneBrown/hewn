/** Pause, resume, cancel and what the project page shows for them (L2-029 AC1, AC2, AC3, AC5). */

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

/** Cancel applies to a queued, running or paused direction (L2-029 AC3). */
export function canCancel(d: { status: string }): boolean {
  return d.status === 'Queued' || d.status === 'Running' || d.status === 'Paused';
}

/** "Cancelled by quinntynebrown on 8 Nov at 17:01", as the cancelled mock's callout reads. */
export function cancelledTitle(
  cancelledBy: string | null,
  cancelledAt: string | null,
  timeZone?: string,
): string {
  if (!cancelledBy || !cancelledAt) return 'Cancelled';
  const at = new Date(cancelledAt);
  const day = at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone });
  const time = at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });
  return `Cancelled by ${cancelledBy} on ${day} at ${time}`;
}

/** How fast the run stopped, which pull requests were labelled, and what to do next. */
export function cancelledBody(stoppedWithinSeconds: number | null, labelled: number[]): string {
  const stopped =
    stoppedWithinSeconds === null
      ? 'No run was in progress.'
      : `The active run stopped within ${stoppedWithinSeconds} ${stoppedWithinSeconds === 1 ? 'second' : 'seconds'}.`;
  const numbers = labelled.map((n) => `#${n}`);
  const pulls =
    numbers.length === 0
      ? ''
      : numbers.length === 1
        ? ` Pull request ${numbers[0]} is open and labelled hewn:cancelled.`
        : ` Pull requests ${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1)} are open and labelled hewn:cancelled.`;
  return `${stopped}${pulls} Merged work is kept. Submit a new direction to continue.`;
}

/** The failed dialog's body when the worker holding the run didn't answer within 10 seconds. */
export function notStopped(worker: string | null): string {
  return `${worker ?? 'The worker'} stopped answering. The lease expires in 60 s and the run won’t resume; try again to cancel now.`;
}

/** What a refused or failed Cancel says. */
export function cancelFailure(status: number): string {
  if (status === 409) return 'The direction already finished, so there was nothing to cancel.';
  return `Cancel didn’t reach Hewn (${status || 'no response'}). Nothing changed; try again.`;
}
