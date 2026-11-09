import type { LeasedRun } from '../api.ts';
import { sleep } from '../sleep.ts';
import type { RunContext, StageExecutor, StageStep } from './stage-executor.ts';

export interface ScriptedExecutorOptions {
  /** Time each step takes. */
  stepMs: number;
  /** Stage whose main step fails, for failure paths in tests and demos. */
  failStage?: number;
}

/**
 * Deterministic stand-in for the real stage executors: every stage prepares, runs and commits, with no agent,
 * model or GitHub call. Used by the e2e stack and local demos until each stage's executor lands.
 */
export class ScriptedStageExecutor implements StageExecutor {
  private readonly options: ScriptedExecutorOptions;

  constructor(options: ScriptedExecutorOptions) {
    this.options = options;
  }

  plan(run: LeasedRun, _context?: RunContext): StageStep[] {
    return [
      this.step('Prepare workspace'),
      this.step(
        `Run ${run.stageName}`,
        run.stage === this.options.failStage ? `Scripted failure in stage ${run.stage}` : undefined,
      ),
      this.step('Commit artifacts'),
    ];
  }

  private step(name: string, failure?: string): StageStep {
    return {
      name,
      execute: async (signal) => {
        await sleep(this.options.stepMs, signal);
        if (signal.aborted) throw signal.reason;
        if (failure) throw new Error(failure);
      },
    };
  }
}
