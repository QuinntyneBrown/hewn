/** Automatic retries, the Blocked direction and Retry stage, as the project page shows them (L2-006). */
import type { PendingRetry } from '@hewn/api';
import type { ToastMessage } from '../../core/toasts';

/** 30 s, 1 min 30 s, 2 min, 10 min. */
export function waitText(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return seconds % 60 === 0 ? `${minutes} min` : `${minutes} min ${seconds % 60} s`;
}

/** "Retry 1 of 3 in 0:24": the stage's live line while an automatic retry waits out its backoff. */
export function retryCountdown(retry: PendingRetry, now: number): string {
  const which = `Retry ${retry.attempt - 1} of ${retry.maxAttempts - 1}`;
  const left = Math.ceil((Date.parse(retry.notBefore) - now) / 1000);
  if (left <= 0) return `${which} starting`;
  return `${which} in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

export function blockedTitle(backoffSeconds: number[]): string {
  return `Stage failed after ${backoffSeconds.length} ${backoffSeconds.length === 1 ? 'retry' : 'retries'}`;
}

/** The reason, the waits Hewn used, and that nothing else stopped. */
export function blockedBody(reason: string | null, backoffSeconds: number[]): string {
  const why = (reason ?? 'The stage failed').replace(/\.?$/, '.');
  const waits = backoffSeconds.map(waitText);
  const list =
    waits.length > 1 ? `${waits.slice(0, -1).join(', ')} and ${waits.at(-1)}` : (waits[0] ?? '');
  return `${why} Retried after ${list}. Other projects keep running. The last 200 log lines are below.`;
}

export function canRetryStage(d: { status: string }): boolean {
  return d.status === 'Blocked';
}

/** What a refused or failed Retry stage says. */
export function retryFailure(status: number): string {
  if (status === 409) {
    return 'Retry stage wasn’t applied: the direction is no longer Blocked. The page shows where it is now.';
  }
  return `Retry stage didn’t reach Hewn (${status || 'no response'}). The direction is still Blocked; try again.`;
}

/** The danger toast when a stage blocks; the page adds Open log and, for Owners, Retry stage. */
export function blockedToast(project: string, stage: string, retries: number): ToastMessage {
  return {
    tone: 'danger',
    title: `${project} is blocked`,
    text: `${stage} failed after ${retries} ${retries === 1 ? 'retry' : 'retries'}. Other projects keep running.`,
  };
}
