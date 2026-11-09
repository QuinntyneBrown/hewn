// Acceptance Test
// Traces to: L2-004, L2-026, L2-050
// Description: The worker registers, leases runs, heartbeats every 10 seconds, checkpoints each step and stops on a lost lease

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageExecutor, StageStep } from '../src/executors/stage-executor.ts';
import { WorkLoop } from '../src/work-loop.ts';
import { FakeHewnApi } from './support/fake-hewn-api.ts';

const registration = { name: 'hewn-local-01', location: 'Local' as const, host: 'test-host', version: '0.1.0' };

/** Executor whose every stage has the given steps, each taking `ms` of (fake) time. */
function timedExecutor(stepCount: number, ms: number, executed: string[] = [], failAt?: string): StageExecutor {
  return {
    plan: (run, _context) =>
      Array.from({ length: stepCount }, (_, i): StageStep => ({
        name: `s${run.stage}.${i + 1}`,
        execute: (signal) =>
          new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
              const name = `s${run.stage}.${i + 1}`;
              executed.push(name);
              if (name === failAt) reject(new Error(`${name} exploded`));
              else resolve();
            }, ms);
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(signal.reason);
            });
          }),
      })),
  };
}

describe('WorkLoop', () => {
  let api: FakeHewnApi;
  let stop: AbortController;

  beforeEach(() => {
    vi.useFakeTimers();
    api = new FakeHewnApi();
    stop = new AbortController();
  });

  afterEach(() => {
    stop.abort();
    vi.useRealTimers();
  });

  function start(executor: StageExecutor): Promise<void> {
    return new WorkLoop({ api, executor, registration, log: () => {} }).run(stop.signal);
  }

  it('registers with its name, location, host and version, then runs stages 0 to 10 in order', async () => {
    api.enqueueStage(0);
    const executed: string[] = [];
    void start(timedExecutor(1, 100, executed));

    await vi.advanceTimersByTimeAsync(5_000);

    expect(api.registrations).toEqual([registration]);
    expect(executed).toEqual(Array.from({ length: 11 }, (_, n) => `s${n}.1`));
    const results = api.calls.filter((c) => c.method === 'result');
    expect(results).toHaveLength(11);
    expect(results.every((c) => c.outcome?.outcome === 'Succeeded')).toBe(true);
  });

  it('sends a heartbeat every 10 seconds while a run executes', async () => {
    api.enqueueStage(0, 0, 0);
    void start(timedExecutor(1, 35_000));

    await vi.advanceTimersByTimeAsync(36_000);

    const beats = api.calls.filter((c) => c.method === 'heartbeat');
    expect(beats).toHaveLength(3);
    expect(beats[1]!.at - beats[0]!.at).toBe(10_000);
    expect(api.count('result')).toBe(1);
  });

  it('checkpoints after each completed step, in order, before reporting the result', async () => {
    api.enqueueStage(0, 0, 0);
    void start(timedExecutor(3, 100));

    await vi.advanceTimersByTimeAsync(1_000);

    const reported = api.calls.filter((c) => c.method === 'checkpoint' || c.method === 'result');
    expect(reported.map((c) => c.step ?? c.method)).toEqual([1, 2, 3, 'result']);
  });

  it('resumes after the last checkpoint without repeating completed steps', async () => {
    api.enqueueStage(4, 2, 4);
    const executed: string[] = [];
    void start(timedExecutor(3, 100, executed));

    await vi.advanceTimersByTimeAsync(1_000);

    expect(executed).toEqual(['s4.3']);
    expect(api.calls.filter((c) => c.method === 'checkpoint').map((c) => c.step)).toEqual([3]);
  });

  it('polls for work no more often than every 15 seconds when idle', async () => {
    void start(timedExecutor(1, 100));

    await vi.advanceTimersByTimeAsync(60_000);

    const leases = api.calls.filter((c) => c.method === 'lease');
    expect(leases.length).toBe(5);
    for (let i = 1; i < leases.length; i++) {
      expect(leases[i]!.at - leases[i - 1]!.at).toBeGreaterThanOrEqual(15_000);
    }
  });

  it('picks up work queued while idle at the next poll', async () => {
    const executed: string[] = [];
    void start(timedExecutor(1, 100, executed));
    await vi.advanceTimersByTimeAsync(1_000);

    api.enqueueStage(0, 0, 0);
    await vi.advanceTimersByTimeAsync(15_000);

    expect(executed).toEqual(['s0.1']);
  });

  it('stops the run and reports nothing further when the lease is lost', async () => {
    api.enqueueStage(0, 0, 0);
    api.heartbeatFaults.push('lost');
    const executed: string[] = [];
    void start(timedExecutor(2, 30_000, executed));

    await vi.advanceTimersByTimeAsync(70_000);

    expect(executed).toEqual([]);
    expect(api.count('checkpoint')).toBe(0);
    expect(api.count('result')).toBe(0);
  });

  it('stops the run after two missed heartbeats', async () => {
    api.enqueueStage(0, 0, 0);
    api.heartbeatFaults.push('down', 'down');
    const executed: string[] = [];
    void start(timedExecutor(1, 45_000, executed));

    await vi.advanceTimersByTimeAsync(60_000);

    expect(api.count('heartbeat')).toBe(2);
    expect(executed).toEqual([]);
    expect(api.count('result')).toBe(0);
  });

  it('keeps the run after one missed heartbeat followed by a good one', async () => {
    api.enqueueStage(0, 0, 0);
    api.heartbeatFaults.push('down');
    void start(timedExecutor(1, 25_000));

    await vi.advanceTimersByTimeAsync(30_000);

    expect(api.count('result')).toBe(1);
  });

  it('gives executors a context that logs and commits through the API with the run and epoch', async () => {
    api.enqueueStage(0, 0, 0);
    void start({
      plan: (_run, context) => [
        {
          name: 'commit',
          execute: async () => {
            await context.log('info', 'hello');
            await context.commit(1, 'msg', [{ path: '.hewn/skills.lock', content: Buffer.from('{}') }]);
          },
        },
      ],
    });

    await vi.advanceTimersByTimeAsync(1_000);

    expect(api.logs).toEqual([{ runId: 'run-1', level: 'info', text: 'hello' }]);
    expect(api.commits).toEqual([
      { runId: 'run-1', idempotencyKey: 'run-1/1/commit', message: 'msg', paths: ['.hewn/skills.lock'] },
    ]);
  });

  it('reports a failed step as a failed run and does not checkpoint it', async () => {
    api.enqueueStage(0, 0, 0);
    void start(timedExecutor(2, 100, [], 's0.2'));

    await vi.advanceTimersByTimeAsync(1_000);

    expect(api.calls.filter((c) => c.method === 'checkpoint').map((c) => c.step)).toEqual([1]);
    const result = api.calls.find((c) => c.method === 'result');
    expect(result?.outcome).toEqual({ outcome: 'Failed', error: 's0.2 exploded' });
  });
});
