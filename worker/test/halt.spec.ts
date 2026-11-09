// Acceptance Test
// Traces to: L2-029
// Description: When an Owner stops all workers, the control poll answers Halt: the worker aborts the step in progress at once and reports nothing more for that run; when workers are started again it leases the same run and carries on after its checkpoint

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageExecutor } from '../src/executors/stage-executor.ts';
import { sleep } from '../src/sleep.ts';
import { WorkLoop } from '../src/work-loop.ts';
import { FakeHewnApi } from './support/fake-hewn-api.ts';

const registration = { name: 'hewn-local-01', location: 'Local' as const, host: 'test-host', version: '0.1.0' };

/** Each step takes 5 seconds, honours the abort signal, and records the steps it finished. */
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

describe('stopping all workers', () => {
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

  it('halts the step in progress when the control poll answers Halt, then resumes after the checkpoint', async () => {
    const run = api.enqueueStage(3, 0, 3);
    const finished: string[] = [];
    void new WorkLoop({ api, executor: slowSteps(3, finished), registration, log: (m) => logs.push(m) }).run(
      stop.signal,
    );
    await vi.advanceTimersByTimeAsync(6_000);

    api.halt();
    await vi.advanceTimersByTimeAsync(10);

    expect(finished).toEqual(['s3.1']);
    expect(logs).toContain('Halted: all workers stopped; the run waits at its checkpoint');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(finished).toEqual(['s3.1']);
    expect(api.count('result')).toBe(0);

    // Start workers: the same run is leased again with a new epoch and carries on from step 2.
    api.requeue({ ...run, epoch: 2, checkpointStep: 1 });
    await vi.advanceTimersByTimeAsync(40_000);

    expect(finished).toEqual(['s3.1', 's3.2', 's3.3']);
    expect(api.calls.filter((c) => c.method === 'step').map((c) => c.step)).toEqual([1, 2, 2, 3]);
    expect(api.count('result')).toBe(1);
  });
});
