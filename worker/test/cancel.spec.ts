// Acceptance Test
// Traces to: L2-029
// Description: While a run executes, the worker holds a control poll open; when it answers Cancel the step in progress is aborted at once, no further step, checkpoint or result is reported, and the worker goes back to leasing

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageExecutor } from '../src/executors/stage-executor.ts';
import { HttpHewnApi } from '../src/http-api.ts';
import { sleep } from '../src/sleep.ts';
import { WorkLoop } from '../src/work-loop.ts';
import { FakeHewnApi } from './support/fake-hewn-api.ts';

const registration = { name: 'hewn-local-01', location: 'Local' as const, host: 'test-host', version: '0.1.0' };

/** Each step takes 5 seconds, honours the abort signal, and records whether it finished. */
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

describe('cancelling a run', () => {
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

  it('aborts the step in progress the moment the control poll answers Cancel, and reports nothing more', async () => {
    api.enqueueStage(0, 0, 0);
    const finished: string[] = [];
    void start(slowSteps(4, finished));
    await vi.advanceTimersByTimeAsync(6_000);
    expect(api.count('control')).toBeGreaterThan(0);

    api.cancel();
    await vi.advanceTimersByTimeAsync(10);

    expect(finished).toEqual(['s0.1']);
    expect(api.calls.filter((c) => c.method === 'step').map((c) => c.step)).toEqual([1, 2]);
    expect(api.calls.filter((c) => c.method === 'checkpoint').map((c) => c.step)).toEqual([1]);
    expect(logs).toContain('Cancelled; the run stops now');

    await vi.advanceTimersByTimeAsync(30_000);
    expect(finished).toEqual(['s0.1']);
    expect(api.count('result')).toBe(0);
    expect(api.count('checkpoint')).toBe(1);
  });

  it('goes back to leasing after a cancel and runs the next direction', async () => {
    api.enqueueStage(0, 0, 0);
    const finished: string[] = [];
    void start(slowSteps(2, finished));
    await vi.advanceTimersByTimeAsync(1_000);
    api.cancel();
    await vi.advanceTimersByTimeAsync(10);

    api.enqueueStage(1, 0, 0);
    await vi.advanceTimersByTimeAsync(26_000);

    expect(finished).toEqual(['s1.1', 's1.2']);
    expect(api.calls.filter((c) => c.method === 'result')).toHaveLength(1);
  });
});

describe('HttpHewnApi control', () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise((resolve) => server?.close(resolve));
  });

  const serve = async (status: number, body?: unknown): Promise<{ api: HttpHewnApi; urls: string[] }> => {
    const urls: string[] = [];
    server = createServer((req, res) => {
      urls.push(req.url!);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    return { api: new HttpHewnApi(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, 'tok'), urls };
  };

  it('returns Cancel when the API answers it, holding the poll for the given seconds', async () => {
    const { api, urls } = await serve(200, { control: 'Cancel' });

    expect(await api.control('wkr', { runId: 'r1', epoch: 3 } as never, 20, new AbortController().signal)).toBe(
      'Cancel',
    );
    expect(urls).toEqual(['/api/worker/runs/r1/control?workerId=wkr&epoch=3&waitSeconds=20']);
  });

  it('returns null when the poll ends with nothing to do', async () => {
    const { api } = await serve(204);

    expect(await api.control('wkr', { runId: 'r1', epoch: 3 } as never, 20, new AbortController().signal)).toBeNull();
  });
});
