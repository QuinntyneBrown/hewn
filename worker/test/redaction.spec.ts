// Acceptance Test
// Traces to: L2-040
// Description: Before a worker sends a run's log lines or failure to the API, or prints a log entry, it replaces a
// credential it holds and any GitHub, Anthropic or Azure token with *** (AC2)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageExecutor } from '../src/executors/stage-executor.ts';
import { jsonLog } from '../src/json-log.ts';
import { redact, rememberSecret } from '../src/redact.ts';
import { WorkLoop } from '../src/work-loop.ts';
import { FakeHewnApi } from './support/fake-hewn-api.ts';

const registration = { name: 'hewn-local-01', location: 'Local' as const, host: 'test-host', version: '0.1.0' };
const stored = 'magic-patterns-credential-without-a-pattern-41d2';
const leaky =
  `calling the model with sk-ant-api03-AbCdEf0123456789xyzXYZ-abcdefgh and ${stored}; ` +
  'git push https://x:ghp_0123456789abcdefghijklmnopqrstuvwxyzAB@github.com; ' +
  'storage AccountName=hewn;AccountKey=Zm9vYmFyYmF6cXV4MDEyMzQ1Njc4OWFiY2RlZg==;EndpointSuffix=core.windows.net; ' +
  'blob ?sv=2024-01-01&sig=AbCdEf0123456789%2Bxyz%3D&se=2026; client secret abc8Q~0123456789abcdefghijklmnopqrstuvw';
const masked =
  'calling the model with *** and ***; git push https://x:***@github.com; ' +
  'storage AccountName=hewn;AccountKey=***;EndpointSuffix=core.windows.net; ' +
  'blob ?sv=2024-01-01&sig=***&se=2026; client secret ***';

describe('worker redaction', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('masks a remembered credential and every token pattern with ***', () => {
    rememberSecret(stored);
    rememberSecret('short');
    expect(redact(leaky)).toBe(masked);
    expect(redact('a short word stays')).toBe('a short word stays');
    expect(redact('password=hunter22 token: abc123def')).toBe('password=*** token: ***');
  });

  it('sends a run’s log lines and its failure to the API already redacted, and prints them redacted', async () => {
    rememberSecret(stored);
    const api = new FakeHewnApi();
    const stop = new AbortController();
    const printed: string[] = [];
    const executor: StageExecutor = {
      plan: (_run, context) => [
        {
          name: 'call the model',
          execute: async () => {
            await context.log('info', leaky);
            throw new Error(`model call refused: ${leaky}`);
          },
        },
      ],
    };
    const run = api.enqueueStage(1, 0, 1);
    void new WorkLoop({ api, executor, registration, log: jsonLog((line) => printed.push(line)) }).run(stop.signal);

    await vi.advanceTimersByTimeAsync(5_000);
    stop.abort();

    expect(api.logs.filter((l) => l.runId === run.runId).map((l) => l.text)).toContain(masked);
    const result = api.calls.find((c) => c.method === 'result' && c.runId === run.runId);
    expect(result?.outcome).toEqual({ outcome: 'Failed', error: `model call refused: ${masked}` });
    const everything = JSON.stringify([api.logs, api.calls]) + printed.join('\n');
    for (const secret of [stored, 'sk-ant-', 'ghp_', 'Zm9vYmFy', 'AbCdEf0123456789%2B', '8Q~']) {
      expect(everything).not.toContain(secret);
    }
  });
});
