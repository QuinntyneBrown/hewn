import type { LeasedRun } from '../api.ts';
import { sleep } from '../sleep.ts';
import type { RunContext, StageExecutor, StageStep } from './stage-executor.ts';

export interface ScriptedExecutorOptions {
  /** Time each step takes. */
  stepMs: number;
  /** Log lines the main step writes, spread over its time, so the live log has something to follow. */
  logLines?: number;
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

  plan(run: LeasedRun, context?: RunContext): StageStep[] {
    return [
      this.step('Prepare workspace'),
      this.step(
        `Run ${run.stageName}`,
        run.stage === this.options.failStage ? `Scripted failure in stage ${run.stage}` : undefined,
        this.options.logLines && context ? { count: this.options.logLines, context, label: run.stageName } : undefined,
      ),
      this.step('Commit artifacts'),
    ];
  }

  private step(
    name: string,
    failure?: string,
    lines?: { count: number; context: RunContext; label: string },
  ): StageStep {
    return {
      name,
      execute: async (signal) => {
        if (lines) {
          const gap = this.options.stepMs / lines.count;
          for (let n = 1; n <= lines.count; n++) {
            await lines.context.log('info', `${lines.label} · line ${n} of ${lines.count}`);
            if (gap >= 1) await sleep(gap, signal);
            if (signal.aborted) throw signal.reason;
          }
        } else {
          await sleep(this.options.stepMs, signal);
        }
        if (signal.aborted) throw signal.reason;
        if (failure) throw new Error(failure);
      },
    };
  }
}
