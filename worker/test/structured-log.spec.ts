// Acceptance Test
// Traces to: L2-049
// Description: Every worker log entry is one line of JSON with timestamp, level and message, and a run's entries carry
// its project, direction, stage and run IDs (AC1); credentials in a message or a field are redacted (L2-040)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageExecutor } from '../src/executors/stage-executor.ts';
import { jsonLog } from '../src/json-log.ts';
import { WorkLoop } from '../src/work-loop.ts';
import { FakeHewnApi } from './support/fake-hewn-api.ts';

const registration = { name: 'hewn-local-01', location: 'Local' as const, host: 'test-host', version: '0.1.0' };
const token = 'ghp_0123456789abcdefghijklmnopqrstuvwxyzAB';

describe('structured worker logs', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('writes one JSON line per entry, with timestamp, level, message and fields, and redacts credentials', () => {
    const lines: string[] = [];
    const log = jsonLog((line) => lines.push(line));

    log('Could not push', { level: 'Warning', runId: 'run-1', error: `remote rejected ${token}` });
    log(`token=${token}`);

    const [first, second] = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(lines.every((l) => !l.includes('\n'))).toBe(true);
    expect(new Date(String(first!['timestamp'])).toISOString()).toBe(first!['timestamp']);
    expect(first).toMatchObject({ level: 'Warning', message: 'Could not push', runId: 'run-1' });
    expect(second).toMatchObject({ level: 'Information' });
    expect(lines.join('\n')).not.toContain(token);
    expect(first!['error']).toContain('***');
  });

  it('puts a run’s project, direction, stage and run IDs on every entry logged while it runs', async () => {
    const api = new FakeHewnApi();
    const stop = new AbortController();
    const entries: Record<string, unknown>[] = [];
    const executor: StageExecutor = {
      plan: () => [{ name: 'only step', execute: () => Promise.resolve() }],
    };
    const run = api.enqueueStage(3, 0, 3);
    void new WorkLoop({
      api,
      executor,
      registration,
      log: (message, fields) => entries.push({ message, ...fields }),
    }).run(stop.signal);

    await vi.advanceTimersByTimeAsync(5_000);
    stop.abort();

    const ofRun = entries.filter((e) => /^(Leased run|Checkpoint|Run succeeded)/.test(String(e['message'])));
    expect(ofRun.map((e) => e['message'])).toEqual(['Leased run', 'Checkpoint', 'Run succeeded']);
    for (const entry of ofRun) {
      expect(entry).toMatchObject({ projectId: 'project-1', directionId: 'direction-1', stage: 3, runId: run.runId });
    }
  });
});
