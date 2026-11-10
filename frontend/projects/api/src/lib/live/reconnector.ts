import { BehaviorSubject } from 'rxjs';

/** Where the live connection stands; `nextAttemptAt` is epoch milliseconds. */
export type ConnectionStatus =
  | { state: 'connecting' }
  | { state: 'live' }
  | { state: 'reconnecting'; nextAttemptAt: number }
  | { state: 'offline'; nextAttemptAt: number };

/** Waits before each attempt: 0, 2, 10 and 30 seconds, then every 30 seconds (L2-032 AC1). */
export const RECONNECT_DELAYS_MS = [0, 2_000, 10_000, 30_000] as const;
const EVERY_MS = 30_000;

/**
 * Brings a dropped connection back on L2-032's schedule. `connect` reconnects and catches up; the status is live only
 * once it resolves. After the four scheduled attempts the connection counts as offline and is tried every 30 seconds
 * until it comes back; Retry now tries at once.
 */
export class Reconnector {
  readonly status$ = new BehaviorSubject<ConnectionStatus>({ state: 'connecting' });
  private failed = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private trying = false;
  private stopped = false;

  constructor(private readonly connect: () => Promise<void>) {}

  /** The first connection is up. */
  connected(): void {
    this.status$.next({ state: 'live' });
  }

  /** The connection dropped: start the schedule from its first attempt. */
  dropped(): void {
    if (this.stopped) return;
    this.failed = 0;
    this.schedule();
  }

  /** Tries at once instead of waiting; a failure carries on with the schedule. */
  async retryNow(): Promise<void> {
    if (this.stopped || this.status$.value.state === 'live') return;
    this.clear();
    await this.attempt();
  }

  stop(): void {
    this.stopped = true;
    this.clear();
  }

  private schedule(): void {
    const delay = RECONNECT_DELAYS_MS[this.failed] ?? EVERY_MS;
    const nextAttemptAt = Date.now() + delay;
    this.status$.next({
      state: this.failed >= RECONNECT_DELAYS_MS.length ? 'offline' : 'reconnecting',
      nextAttemptAt,
    });
    this.clear();
    this.timer = setTimeout(() => void this.attempt(), delay);
  }

  private async attempt(): Promise<void> {
    if (this.trying || this.stopped) return;
    this.timer = null;
    this.trying = true;
    try {
      await this.connect();
      this.failed = 0;
      this.status$.next({ state: 'live' });
    } catch {
      this.failed++;
      this.schedule();
    } finally {
      this.trying = false;
    }
  }

  private clear(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
