// Acceptance Test
// Traces to: L2-040
// Description: Credentials a run writes into its workspace (git credentials, .npmrc, .netrc, a gh login) are deleted
// when the run ends, whether it succeeds, fails or loses its lease, and even when part of the workspace was left
// read-only (AC3)

import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageExecutor } from '../src/executors/stage-executor.ts';
import { WorkLoop } from '../src/work-loop.ts';
import { FakeHewnApi } from './support/fake-hewn-api.ts';

const registration = { name: 'hewn-local-01', location: 'Local' as const, host: 'test-host', version: '0.1.0' };

/** Writes credentials as an agent's tools might, then ends the run as `end` says. */
function writingCredentials(
  api: FakeHewnApi,
  workspaces: string[],
  end: 'succeed' | 'fail' | 'lose',
  lockSubfolder = false,
): StageExecutor {
  return {
    plan: (_run, context) => [
      {
        name: 'build',
        execute: async () => {
          const ws = context.workspace;
          workspaces.push(ws);
          writeFileSync(
            join(ws, '.git-credentials'),
            'https://x:ghp_0123456789abcdefghijklmnopqrstuvwxyzAB@github.com\n',
          );
          writeFileSync(join(ws, '.npmrc'), '//registry.npmjs.org/:_authToken=npm_0123456789abcdef\n');
          writeFileSync(join(ws, '.netrc'), 'machine api.anthropic.com password sk-ant-api03-0123456789abcdef\n');
          mkdirSync(join(ws, 'app', '.config', 'gh'), { recursive: true });
          writeFileSync(
            join(ws, 'app', '.config', 'gh', 'hosts.yml'),
            'github.com:\n  oauth_token: gho_0123456789abcdef\n',
          );
          if (lockSubfolder) chmodSync(join(ws, 'app', '.config'), 0o500);
          if (end === 'fail') throw new Error('build failed');
          // A lost lease: the next heartbeat is answered 409.
          if (end === 'lose') api.heartbeatFaults.push('lost');
        },
      },
    ],
  };
}

describe('workspace credentials at run end', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(['succeed', 'fail', 'lose'] as const)('are gone after a run that ends with %s', async (end) => {
    const api = new FakeHewnApi();
    const workspaces: string[] = [];
    const stop = new AbortController();
    api.enqueueStage(1, 0, 1);
    void new WorkLoop({ api, executor: writingCredentials(api, workspaces, end), registration, log: () => {} }).run(
      stop.signal,
    );

    await vi.advanceTimersByTimeAsync(40_000);
    stop.abort();

    expect(workspaces).toHaveLength(1);
    expect(existsSync(workspaces[0]!)).toBe(false);
  });

  it('are gone even when the run left a folder read-only, and the worker goes on to the next run', async () => {
    const api = new FakeHewnApi();
    const workspaces: string[] = [];
    const entries: { message: string; fields?: Record<string, unknown> }[] = [];
    const stop = new AbortController();
    api.enqueueStage(1, 0, 2);
    void new WorkLoop({
      api,
      executor: writingCredentials(api, workspaces, 'succeed', true),
      registration,
      log: (message, fields) => entries.push({ message, fields }),
    }).run(stop.signal);

    await vi.advanceTimersByTimeAsync(10_000);
    stop.abort();

    expect(workspaces).toHaveLength(2);
    for (const workspace of workspaces) expect(existsSync(workspace)).toBe(false);
    expect(entries.filter((e) => e.fields?.['level'] === 'Error')).toEqual([]);
  });
});
