import { AuditAction } from '@hewn/api';

/** Each action with its label, in the order the mock's filter lists them. */
export const AUDIT_ACTIONS: readonly { value: AuditAction; label: string }[] = [
  { value: 'SignIn', label: 'Sign in' },
  { value: 'DirectionSubmitted', label: 'Direction submitted' },
  { value: 'Pause', label: 'Pause' },
  { value: 'Resume', label: 'Resume' },
  { value: 'Cancel', label: 'Cancel' },
  { value: 'Merge', label: 'Merge' },
  { value: 'TokenCreated', label: 'Token created' },
  { value: 'TokenRevoked', label: 'Token revoked' },
  { value: 'StopAll', label: 'Stop all workers' },
  { value: 'StartWorkers', label: 'Start workers' },
];

export function actionLabel(action: AuditAction): string {
  return AUDIT_ACTIONS.find((a) => a.value === action)?.label ?? action;
}

/** Actions that stop or take something away read in the warning colour, as the mock shows; the label says it too. */
export function actionWarns(action: AuditAction): boolean {
  return action === 'Cancel' || action === 'TokenRevoked' || action === 'StopAll';
}

export function parseAction(value: string | null): AuditAction | null {
  return AUDIT_ACTIONS.find((a) => a.value === value)?.value ?? null;
}

/** "9 Nov 2026, 14:31:07", in the viewer's time zone unless one is given. */
export function auditTime(at: string, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(new Date(at));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')}:${part('second')}`;
}

const notOnProjects: readonly AuditAction[] = ['SignIn', 'TokenCreated', 'TokenRevoked'];

/** Why no entry matches, so the Owner knows whether to widen the filter. */
export function noResultsText(project: string | null, action: AuditAction | null): string {
  if (project && action === 'StopAll') {
    return `Nobody stopped all workers from ${project}. Stop all is recorded against All projects.`;
  }
  if (project && action === 'StartWorkers') {
    return `Nobody started workers from ${project}. Start workers is recorded against All projects.`;
  }
  if (project && action && notOnProjects.includes(action)) {
    return `${actionLabel(action)} isn’t recorded against a project; choose All projects to see it.`;
  }
  if (project && action) return `Nothing was recorded as ${actionLabel(action)} on ${project}.`;
  if (project) return `Nothing was recorded on ${project}.`;
  return `Nothing was recorded as ${actionLabel(action ?? 'SignIn')}.`;
}

export function loadFailure(status: number): string {
  return `The audit store returned ${status || 'no response'}. Entries are still being written; nothing has been lost.`;
}
