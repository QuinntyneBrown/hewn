// Acceptance Test
// Traces to: L2-004
// Description: The scripted executor replays deterministic stages for tests and demos, failing only the stage it is told to

import { describe, expect, it } from 'vitest';
import { ScriptedStageExecutor } from '../src/executors/scripted-executor.ts';
import type { LeasedRun } from '../src/api.ts';
import type { RunContext } from '../src/executors/stage-executor.ts';

const context = {} as RunContext;

const run = (stage: number): LeasedRun => ({
  runId: 'r',
  epoch: 1,
  projectId: 'p',
  directionId: 'd',
  stage,
  stageName: 'Idea',
  checkpointStep: 0,
  checkpointSha: null,
  project: { id: 'p', name: 'Ledgerline', idea: 'x', stackPreference: null, repository: null },
  skillsSource: 'unused',
  descopeThresholdDays: 3,
  maxIterations: 10,
});

describe('ScriptedStageExecutor', () => {
  it('plans the same named steps for every stage and completes them', async () => {
    const executor = new ScriptedStageExecutor({ stepMs: 0 });

    const steps = executor.plan(run(1), context);
    for (const step of steps) await step.execute(new AbortController().signal);

    expect(steps.map((s) => s.name)).toEqual(['Prepare workspace', 'Run Idea', 'Commit artifacts']);
  });

  it('fails the configured stage at its main step', async () => {
    const executor = new ScriptedStageExecutor({ stepMs: 0, failStage: 3 });

    const [prepare, main] = executor.plan(run(3), context);
    await prepare!.execute(new AbortController().signal);

    await expect(main!.execute(new AbortController().signal)).rejects.toThrow('Scripted failure in stage 3');
  });

  it('opens a pull request in the configured stage, as Scaffold does, before its log lines', async () => {
    const calls: string[] = [];
    const prContext = {
      commit: async (_step: unknown, message: string, files: { path: string }[], branch?: string) => {
        calls.push(`commit ${branch} ${files.map((f) => f.path).join(',')} ${message}`);
        return 'sha';
      },
      openPullRequest: async (_step: unknown, request: { head: string; title: string }) => {
        calls.push(`pr ${request.head} ${request.title}`);
        return { number: 1, url: 'u' };
      },
      log: async (_level: string, text: string) => {
        calls.push(text);
      },
    } as unknown as RunContext;
    const executor = new ScriptedStageExecutor({ stepMs: 0, logLines: 1, pullRequestStage: 6 });

    const [, main] = executor.plan({ ...run(6), stageName: 'Scaffold' }, prContext);
    await main!.execute(new AbortController().signal);
    const [, other] = executor.plan(run(5), prContext);
    await other!.execute(new AbortController().signal);

    expect(calls).toEqual([
      'commit hewn/scaffold README.md Scaffold the solution',
      'pr hewn/scaffold Scaffold the solution',
      'Scaffold · line 1 of 1',
      'Idea · line 1 of 1',
    ]);
  });
});
