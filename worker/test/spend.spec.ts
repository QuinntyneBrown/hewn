// Acceptance Test
// Traces to: L2-052, L2-053
// Description: The worker reports every model call with its model and tokens, writes the 80% warning into the run log, and ends the run right after the call that reaches the budget

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeasedRun } from '../src/api.ts';
import { ScriptedStageExecutor } from '../src/executors/scripted-executor.ts';
import type { RunContext, StageExecutor } from '../src/executors/stage-executor.ts';
import { WorkLoop } from '../src/work-loop.ts';
import { FakeHewnApi } from './support/fake-hewn-api.ts';

const registration = { name: 'hewn-local-01', location: 'Local' as const, host: 'test-host', version: '0.1.0' };

/** Each step makes `calls` model calls of 1,000 input and 100 output tokens. */
function callingExecutor(stepCount: number, calls: number): StageExecutor {
  return {
    plan: (_run, context) =>
      Array.from({ length: stepCount }, (_, i) => ({
        name: `Step ${i + 1}`,
        execute: async () => {
          for (let n = 0; n < calls; n++) {
            await context.recordModelCall({ model: 'claude-opus-5-5', inputTokens: 1_000, outputTokens: 100 });
          }
        },
      })),
  };
}

describe('metering model calls', () => {
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

  it('reports every model call with its model and tokens, each under its own call id', async () => {
    const run = api.enqueueStage(0, 0, 0);
    void start(callingExecutor(2, 2));

    await vi.advanceTimersByTimeAsync(1_000);

    expect(api.modelCalls).toHaveLength(4);
    for (const call of api.modelCalls) {
      expect(call).toMatchObject({ runId: run.runId, model: 'claude-opus-5-5', inputTokens: 1_000, outputTokens: 100 });
    }
    expect(new Set(api.modelCalls.map((c) => c.callId)).size).toBe(4);
    expect(api.calls.find((c) => c.method === 'result')?.outcome).toEqual({ outcome: 'Succeeded' });
  });

  it('writes the 80% warning into the run log and carries on', async () => {
    api.enqueueStage(0, 0, 0);
    api.verdicts.push(
      { verdict: 'Continue', directionSpendUsd: 6, budgetUsd: 10 },
      { verdict: 'Warn', directionSpendUsd: 8, budgetUsd: 10 },
    );
    void start(callingExecutor(1, 3));

    await vi.advanceTimersByTimeAsync(1_000);

    expect(api.logs).toContainEqual(
      expect.objectContaining({ level: 'warn', text: 'Spend at 80% of budget ($8.00 of $10.00)' }),
    );
    expect(api.modelCalls).toHaveLength(3);
    expect(api.calls.find((c) => c.method === 'result')?.outcome).toEqual({ outcome: 'Succeeded' });
  });

  it('ends the run right after the call that reaches the budget, without another call, checkpoint or result', async () => {
    api.enqueueStage(0, 0, 0);
    api.verdicts.push(
      { verdict: 'Continue', directionSpendUsd: 6, budgetUsd: 10 },
      { verdict: 'Stop', directionSpendUsd: 12, budgetUsd: 10 },
    );
    void start(callingExecutor(2, 3));

    await vi.advanceTimersByTimeAsync(1_000);

    expect(api.modelCalls).toHaveLength(2);
    expect(api.calls.filter((c) => c.method === 'checkpoint')).toHaveLength(0);
    expect(api.calls.filter((c) => c.method === 'result')).toHaveLength(0);
  });
});

describe('the scripted executor', () => {
  it('makes the configured model calls in its main step', async () => {
    const calls: { model: string; inputTokens: number; outputTokens: number }[] = [];
    const context = {
      log: async () => {},
      recordModelCall: async (call: (typeof calls)[number]) => void calls.push(call),
    } as unknown as RunContext;
    const run = { stage: 1, stageName: 'Idea' } as LeasedRun;

    for (const step of new ScriptedStageExecutor({ stepMs: 0, modelCalls: 4, callTokens: 50_000 }).plan(run, context)) {
      await step.execute(new AbortController().signal);
    }

    expect(calls).toEqual(
      Array.from({ length: 4 }, () => ({ model: 'claude-opus-5-5', inputTokens: 50_000, outputTokens: 5_000 })),
    );
  });
});
