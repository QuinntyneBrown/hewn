import { IconName } from '@hewn/components';

const and = (names: string[]) =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/** The Stop all workers dialog's text (L2-029 AC4): the online workers, and the projects that keep their checkpoints. */
export function stopDialogText(
  workers: readonly { online: boolean; workingOn: { projectName: string } | null }[],
): string {
  const online = workers.filter((w) => w.online);
  if (online.length === 0) {
    return 'No worker is online. Leasing stops, so nothing new starts until you start workers again.';
  }
  const halt =
    online.length === 1
      ? 'The online worker halts its active run within 10 seconds and stops leasing.'
      : `All ${online.length} online workers halt their active runs within 10 seconds and stop leasing.`;
  const projects = online.flatMap((w) => (w.workingOn ? [w.workingOn.projectName] : []));
  if (projects.length === 0) return halt;
  const keep =
    projects.length === 1
      ? 'keeps its last checkpoint and resumes from it'
      : 'keep their last checkpoints and resume from them';
  return `${halt} ${and(projects)} ${keep} when you start workers again.`;
}

/** The system banner while leasing is off. */
export function stoppedBanner(
  leasing: { stopped: boolean; changedBy: string | null; changedAt: string | null },
  timeZone?: string,
): string {
  const time = leasing.changedAt
    ? new Date(leasing.changedAt).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
      })
    : null;
  const by = leasing.changedBy && time ? ` by ${leasing.changedBy} at ${time}` : '';
  return `All workers stopped${by}. Nothing new will be leased until you start them again.`;
}

/** The dialog's failed state: the workers that didn't hear the halt within the deadline. */
export function unconfirmed(
  names: readonly string[],
  online: number,
): { title: string; body: string } {
  const one = names.length === 1;
  const others = names.length < online ? ' The others stopped.' : '';
  return {
    title: `${names.length} ${one ? 'worker' : 'workers'} didn’t confirm`,
    body:
      `${and([...names])} didn’t acknowledge within 10 s.${others} Leasing is off, so ` +
      (one
        ? 'it can’t pick up new work; try again to stop it.'
        : 'they can’t pick up new work; try again to stop them.'),
  };
}

export function busyLabel(count: number): string {
  return `Stopping ${count} ${count === 1 ? 'worker' : 'workers'}…`;
}

/** A worker's status, always with an icon and a label. */
export function workerStatus(status: string): {
  label: string;
  tone: 'run' | 'idle' | 'fail';
  icon: IconName;
} {
  if (status === 'Busy') return { label: 'Leased', tone: 'run', icon: 'spinner' };
  if (status === 'Offline') return { label: 'Offline', tone: 'fail', icon: 'wifiOff' };
  return { label: 'Idle', tone: 'idle', icon: 'idleCircle' };
}

/** What a worker is doing when it isn't running a project; null when the project's name says it. */
export function workerActivity(w: { status: string; holding: boolean }): string | null {
  if (w.status === 'Busy') return null;
  if (w.holding) return 'Holding at checkpoint';
  return w.status === 'Offline' ? 'Lease released' : 'Waiting for work';
}

export function seenAgo(at: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(at)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function connectedFor(since: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(since)) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
