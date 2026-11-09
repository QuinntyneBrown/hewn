// Acceptance Test
// Traces to: L2-029, L2-050
// Description: When a checkpoint answers Pause, the worker stops the run there: the step in progress has finished, no further step starts and no result is reported; a resumed run starts after its checkpoint

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageExecutor } from '../src/executors/stage-executor.ts';
import { HttpHewnApi } from '../src/http-api.ts';
import { WorkLoop } from '../src/work-loop.ts';
import { FakeHewnApi } from './support/fake-hewn-api.ts';

const registration = { name: 'hewn-local-01', location: 'Local' as const, host: 'test-host', version: '0.1.0' };

/** Each step takes 100 ms and records its name when it finishes. */
function steps(count: number, executed: string[]): StageExecutor {
  return {
    plan: (run) =>
      Array.from({ length: count }, (_, i) => ({
        name: `Step ${i + 1}`,
        execute: () =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              executed.push(`s${run.stage}.${i + 1}`);
              resolve();
            }, 100),
          ),
      })),
  };
}

describe('pausing at a checkpoint', () => {
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

  const start = (executor: StageExecutor) =>
    new WorkLoop({ api, executor, registration, log: (message) => logs.push(message) }).run(stop.signal);

  it('finishes the step in progress, then starts no further step and reports no result', async () => {
    api.enqueueStage(0, 0, 0);
    api.checkpointVerdicts.push('Continue', 'Pause');
    const executed: string[] = [];
    void start(steps(4, executed));

    await vi.advanceTimersByTimeAsync(2_000);

    expect(executed).toEqual(['s0.1', 's0.2']);
    expect(api.calls.filter((c) => c.method === 'step').map((c) => c.step)).toEqual([1, 2]);
    expect(api.calls.filter((c) => c.method === 'checkpoint').map((c) => c.step)).toEqual([1, 2]);
    expect(api.count('result')).toBe(0);
    expect(logs).toContain('Paused at a checkpoint; the run stops here');
  });

  it('goes back to leasing after a pause, and the resumed run starts after its checkpoint', async () => {
    api.enqueueStage(0, 0, 0);
    api.checkpointVerdicts.push('Pause');
    const executed: string[] = [];
    void start(steps(3, executed));
    await vi.advanceTimersByTimeAsync(1_000);

    api.enqueueStage(0, 1, 0);
    await vi.advanceTimersByTimeAsync(16_000);

    expect(executed).toEqual(['s0.1', 's0.2', 's0.3']);
    expect(api.calls.filter((c) => c.method === 'result')).toHaveLength(1);
  });
});

describe('HttpHewnApi checkpoint', () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise((resolve) => server?.close(resolve));
  });

  it('returns the verdict the API answers', async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ verdict: 'Pause' }));
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const api = new HttpHewnApi(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, 'tok');

    expect(await api.checkpoint('wkr', { runId: 'r1', epoch: 1 } as never, 2)).toBe('Pause');
  });
});
