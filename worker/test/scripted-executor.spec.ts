// Acceptance Test
// Traces to: L2-004
// Description: The scripted executor replays deterministic stages for tests and demos, failing only the stage it is told to

import { describe, expect, it } from 'vitest';
import { ScriptedStageExecutor } from '../src/executors/scripted-executor.ts';
import type { LeasedRun } from '../src/api.ts';

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
});

describe('ScriptedStageExecutor', () => {
  it('plans the same named steps for every stage and completes them', async () => {
    const executor = new ScriptedStageExecutor({ stepMs: 0 });

    const steps = executor.plan(run(1));
    for (const step of steps) await step.execute(new AbortController().signal);

    expect(steps.map((s) => s.name)).toEqual(['Prepare workspace', 'Run Idea', 'Commit artifacts']);
  });

  it('fails the configured stage at its main step', async () => {
    const executor = new ScriptedStageExecutor({ stepMs: 0, failStage: 3 });

    const [prepare, main] = executor.plan(run(3));
    await prepare!.execute(new AbortController().signal);

    await expect(main!.execute(new AbortController().signal)).rejects.toThrow('Scripted failure in stage 3');
  });
});
