// Acceptance Test
// Traces to: L2-041
// Description: When an Owner revokes a worker's token, the worker is disconnected within 10 seconds: its held control poll answers that the lease is lost, it aborts the step in progress and reports nothing more, and once the API refuses its token it stops asking for work

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageExecutor } from '../src/executors/stage-executor.ts';
import { sleep } from '../src/sleep.ts';
import { WorkLoop } from '../src/work-loop.ts';
import { FakeHewnApi } from './support/fake-hewn-api.ts';

const registration = { name: 'build-box-02', location: 'Local' as const, host: 'test-host', version: '0.1.0' };

function slowSteps(count: number, finished: string[]): StageExecutor {
  return {
    plan: (run) =>
      Array.from({ length: count }, (_, i) => ({
        name: `Step ${i + 1}`,
        execute: async (signal: AbortSignal) => {
          await sleep(5_000, signal);
          if (signal.aborted) throw signal.reason;
          finished.push(`s${run.stage}.${i + 1}`);
        },
      })),
  };
}

describe('revoking a worker', () => {
  let api: FakeHewnApi;
  let stop: AbortController;
  const logs: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    api = new FakeHewnApi();
    stop = new AbortController();
    logs.length = 0;
  });

  afterEach(() => {
    stop.abort();
    vi.useRealTimers();
  });

  it('aborts the run at once and stops, asking the API for nothing more', async () => {
    api.enqueueStage(3, 0, 3);
    const finished: string[] = [];
    let ended = false;
    void new WorkLoop({ api, executor: slowSteps(3, finished), registration, log: (m) => logs.push(m) })
      .run(stop.signal)
      .then(() => (ended = true));
    await vi.advanceTimersByTimeAsync(6_000);

    api.revoke();
    await vi.advanceTimersByTimeAsync(100);

    expect(finished).toEqual(['s3.1']);
    expect(logs).toContain('Lease lost');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(logs).toContain('The API refused this worker’s token (revoked or expired); stopping');
    expect(ended).toBe(true);

    const calls = api.calls.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(api.calls.length).toBe(calls);
    expect(api.count('result')).toBe(0);
    expect(finished).toEqual(['s3.1']);
  });

  it('stops when its token is refused while idle', async () => {
    let ended = false;
    void new WorkLoop({ api, executor: slowSteps(1, []), registration, log: (m) => logs.push(m) })
      .run(stop.signal)
      .then(() => (ended = true));
    await vi.advanceTimersByTimeAsync(1_000);

    api.revoke();
    await vi.advanceTimersByTimeAsync(40_000);

    expect(ended).toBe(true);
    expect(logs).toContain('The API refused this worker’s token (revoked or expired); stopping');
  });
});
