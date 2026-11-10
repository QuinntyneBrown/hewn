import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionStatus, Reconnector } from './reconnector';

describe('Reconnector', () => {
  beforeEach(() => vi.useFakeTimers({ now: 0 }));
  afterEach(() => vi.useRealTimers());

  function setup(succeedOnAttempt = Infinity) {
    const attempts: number[] = [];
    const statuses: ConnectionStatus[] = [];
    const reconnector = new Reconnector(async () => {
      attempts.push(Date.now());
      if (attempts.length < succeedOnAttempt) throw new Error('refused');
    });
    reconnector.status$.subscribe((s) => statuses.push(s));
    return { reconnector, attempts, statuses };
  }

  it('retries after 0, 2, 10 and 30 seconds, then every 30 seconds (L2-032 AC1)', async () => {
    const { reconnector, attempts } = setup();

    reconnector.dropped();
    await vi.advanceTimersByTimeAsync(0 + 2_000 + 10_000 + 30_000 + 30_000 + 30_000);

    expect(attempts).toEqual([0, 2_000, 12_000, 42_000, 72_000, 102_000]);
  });

  it('says Reconnecting with the next attempt time, then Offline once it retries every 30 seconds', async () => {
    const { reconnector, statuses } = setup();

    reconnector.dropped();
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses.at(-1)).toEqual({ state: 'reconnecting', nextAttemptAt: 2_000 });
    await vi.advanceTimersByTimeAsync(2_000 + 10_000);
    expect(statuses.at(-1)).toEqual({ state: 'reconnecting', nextAttemptAt: 42_000 });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(statuses.at(-1)).toEqual({ state: 'offline', nextAttemptAt: 72_000 });
  });

  it('is live again once an attempt succeeds and stops retrying', async () => {
    const { reconnector, attempts, statuses } = setup(3);

    reconnector.dropped();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(attempts).toEqual([0, 2_000, 12_000]);
    expect(statuses.at(-1)).toEqual({ state: 'live' });
  });

  it('Retry now tries at once and keeps the schedule if it fails', async () => {
    const { reconnector, attempts } = setup();
    reconnector.dropped();
    await vi.advanceTimersByTimeAsync(2_000 + 10_000 + 30_000 + 5_000);

    await reconnector.retryNow();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(attempts).toEqual([0, 2_000, 12_000, 42_000, 47_000, 77_000]);
  });
});
