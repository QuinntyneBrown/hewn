import type { CatchUp, ConnectionStatus } from '@hewn/api';

export interface ConnectionBanner {
  tone: 'info' | 'warn' | 'danger' | 'ok';
  text: string;
  /** Offers Retry now. */
  retry?: true;
}

const number = (n: number) => `#${n.toLocaleString('en-US')}`;

/** The strip above every page while the live connection is not plain Live (L2-032). */
export function connectionBanner(
  status: ConnectionStatus,
  now: number,
  lastSequence: number | null,
  caughtUp: CatchUp | null,
): ConnectionBanner | null {
  switch (status.state) {
    case 'connecting':
      return {
        tone: 'info',
        text: 'Connecting to Mission Control… live updates start in a moment.',
      };
    case 'reconnecting': {
      const seconds = Math.ceil((status.nextAttemptAt - now) / 1000);
      const next = seconds > 0 ? ` next attempt in ${seconds} s.` : '';
      const from =
        lastSequence === null ? '' : ` Missed events will catch up from ${number(lastSequence)}.`;
      return { tone: 'warn', text: `Reconnecting…${next}${from}` };
    }
    case 'offline':
      return {
        tone: 'danger',
        text: 'Connection lost. Retrying every 30 s; agents keep working and nothing is lost.',
        retry: true,
      };
    case 'live':
      return caughtUp === null
        ? null
        : { tone: 'ok', text: `Reconnected. ${caughtUpText(caughtUp)}` };
  }
}

function caughtUpText({ count, from, to }: CatchUp): string {
  if (count === 0 || from === null || to === null) return 'Nothing was missed.';
  if (count === 1) return `Caught up 1 missed event, ${number(to)}.`;
  return `Caught up ${count} missed events, ${number(from)} to ${number(to)}.`;
}

/** The sidebar's connection label and dot; the label carries the state, never the colour alone. */
export function connectionState(status: ConnectionStatus): { label: string; dot: string } {
  switch (status.state) {
    case 'live':
      return { label: 'Live', dot: '' };
    case 'offline':
      return { label: 'Offline', dot: 'dot--danger' };
    case 'reconnecting':
      return { label: 'Reconnecting…', dot: 'dot--warn pulse' };
    case 'connecting':
      return { label: 'Connecting…', dot: 'dot--warn pulse' };
  }
}
