// Acceptance Test
// Traces to: L2-030, L2-031, L2-033, L2-054
// Description: The worker names each step before it runs, sends log lines in batches before each checkpoint, and reports the decisions a document stage committed

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeasedRun, ReportedDecision } from '../src/api.ts';
import { ScriptedStageAgent } from '../src/agents/scripted-agent.ts';
import { DocumentStageExecutor } from '../src/executors/document-executor.ts';
import { ScriptedStageExecutor } from '../src/executors/scripted-executor.ts';
import type { RunContext, StageExecutor } from '../src/executors/stage-executor.ts';
import { WorkLoop } from '../src/work-loop.ts';
import { FakeHewnApi } from './support/fake-hewn-api.ts';
import { noPullRequests } from './support/no-pull-requests.ts';

const registration = { name: 'hewn-local-01', location: 'Local' as const, host: 'test-host', version: '0.1.0' };

/** Each step logs `lines` lines, one per millisecond, then finishes. */
function loggingExecutor(stepCount: number, lines: number): StageExecutor {
  return {
    plan: (run, context) =>
      Array.from({ length: stepCount }, (_, i) => ({
        name: `Step ${i + 1} of stage ${run.stage}`,
        execute: async () => {
          for (let n = 1; n <= lines; n++) {
            await context.log('info', `s${i + 1} line ${n}`);
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
        },
      })),
  };
}

describe('live progress from the work loop', () => {
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

  const start = (executor: StageExecutor) =>
    new WorkLoop({ api, executor, registration, log: () => {} }).run(stop.signal);

  it('names each step before running it, then checkpoints it', async () => {
    api.enqueueStage(0, 0, 0);
    void start(loggingExecutor(3, 0));

    await vi.advanceTimersByTimeAsync(1_000);

    const progress = api.calls.filter((c) => c.method === 'step' || c.method === 'checkpoint');
    expect(progress.map((c) => `${c.method} ${c.step}${c.name ? ` ${c.name}` : ''}`)).toEqual([
      'step 1 Step 1 of stage 0',
      'checkpoint 1',
      'step 2 Step 2 of stage 0',
      'checkpoint 2',
      'step 3 Step 3 of stage 0',
      'checkpoint 3',
    ]);
  });

  it('numbers steps from the checkpoint when a run resumes', async () => {
    api.enqueueStage(4, 2, 4);
    void start(loggingExecutor(3, 0));

    await vi.advanceTimersByTimeAsync(1_000);

    expect(api.calls.filter((c) => c.method === 'step').map((c) => c.step)).toEqual([3]);
  });

  it('sends log lines in batches, in order, and all of a step before its checkpoint', async () => {
    api.enqueueStage(0, 0, 0);
    void start(loggingExecutor(2, 40));

    await vi.advanceTimersByTimeAsync(2_000);

    expect(api.logs.map((l) => l.text)).toEqual([
      ...Array.from({ length: 40 }, (_, n) => `s1 line ${n + 1}`),
      ...Array.from({ length: 40 }, (_, n) => `s2 line ${n + 1}`),
    ]);
    // 80 lines in 80 ms of steps: a handful of batches, not one request per line.
    expect(api.logBatches).toBeLessThanOrEqual(6);
    const firstCheckpoint = api.calls.find((c) => c.method === 'checkpoint')!;
    expect(api.logTimes.filter((at) => at > firstCheckpoint.at)).toHaveLength(40);
  });

  it('sends a failed step’s lines before reporting the failure', async () => {
    api.enqueueStage(0, 0, 0);
    void start({
      plan: (_run, context) => [
        {
          name: 'Explode',
          execute: async () => {
            await context.log('error', 'about to fail');
            throw new Error('boom');
          },
        },
      ],
    });

    await vi.advanceTimersByTimeAsync(1_000);

    expect(api.logs.map((l) => l.text)).toEqual(['about to fail']);
    expect(api.calls.find((c) => c.method === 'result')!.at).toBeGreaterThanOrEqual(api.logTimes[0]!);
  });
});

describe('the scripted executor', () => {
  it('writes the configured number of log lines in its main step', async () => {
    const lines: string[] = [];
    const context = { log: async (_level: string, text: string) => void lines.push(text) } as RunContext;
    const run = { stage: 1, stageName: 'Idea' } as LeasedRun;

    for (const step of new ScriptedStageExecutor({ stepMs: 0, logLines: 25 }).plan(run, context)) {
      await step.execute(new AbortController().signal);
    }

    expect(lines).toHaveLength(25);
    expect(lines[0]).toBe('Idea · line 1 of 25');
  });
});

describe('a document stage', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hewn-live-'));
    mkdirSync(join(root, 'ledgerline-abc1234'));
    writeFileSync(join(root, 'ledgerline-abc1234', 'README.md'), '# Ledgerline\n');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('reports the decisions it committed, with their rationale, after the commit', async () => {
    const order: string[] = [];
    const reported: ReportedDecision[] = [];
    const context: RunContext = {
      workspace: mkdtempSync(join(root, 'ws-')),
      log: async () => {},
      ...noPullRequests,
      listSkillFolders: async () => ({}),
      downloadRepository: async () => execFileSync('tar', ['-czf', '-', '-C', root, 'ledgerline-abc1234']),
      commit: async () => {
        order.push('commit');
        return 'c0ffee';
      },
      recordModelCall: async () => {},
      recordDecisions: async (decisions) => {
        order.push('decisions');
        reported.push(...decisions);
      },
    };
    const run = {
      runId: 'r1',
      epoch: 1,
      projectId: 'p',
      directionId: 'd',
      stage: 1,
      stageName: 'Idea',
      checkpointStep: 0,
      checkpointSha: null,
      project: {
        id: 'p',
        name: 'Ledgerline',
        idea: 'A web app for small accounting teams.',
        stackPreference: null,
        repository: 'o/r',
      },
      skillsSource: 'unused',
      descopeThresholdDays: 3,
      maxIterations: 10,
    } as LeasedRun;

    for (const step of new DocumentStageExecutor(new ScriptedStageAgent(() => '2026-11-09')).plan(run, context)) {
      await step.execute(new AbortController().signal);
    }

    expect(order).toEqual(['commit', 'decisions']);
    expect(reported.length).toBeGreaterThan(0);
    for (const decision of reported) {
      expect(decision.question).not.toBe('');
      expect(decision.answer).not.toBe('');
      expect(decision.rationale).not.toBe('');
    }
  });
});
