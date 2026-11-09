import type { LeasedRun } from '../api.ts';
import { sleep } from '../sleep.ts';
import type { RunContext, StageExecutor, StageStep } from './stage-executor.ts';

export interface ScriptedExecutorOptions {
  /** Time each step takes. */
  stepMs: number;
  /** Log lines the main step writes, spread over its time, so the live log has something to follow. */
  logLines?: number;
  /** Model calls the main step makes, reported like a real agent's (L2-052), so spend climbs live. */
  modelCalls?: number;
  /** Input tokens per scripted model call; output is a tenth of it. */
  callTokens?: number;
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
        context && (this.options.logLines || this.options.modelCalls) ? { context, label: run.stageName } : undefined,
      ),
      this.step('Commit artifacts'),
    ];
  }

  private step(name: string, failure?: string, work?: { context: RunContext; label: string }): StageStep {
    return {
      name,
      execute: async (signal) => {
        if (work) {
          const actions = this.actions(work.context, work.label);
          const gap = this.options.stepMs / actions.length;
          for (const action of actions) {
            await action();
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

  /** The main step's log lines and model calls, with the calls spread evenly among the lines. */
  private actions(context: RunContext, label: string): (() => Promise<void>)[] {
    const lines = this.options.logLines ?? 0;
    const calls = this.options.modelCalls ?? 0;
    const tokens = this.options.callTokens ?? 10_000;
    const call = () =>
      context.recordModelCall({ model: 'claude-opus-5-5', inputTokens: tokens, outputTokens: Math.round(tokens / 10) });
    const actions: (() => Promise<void>)[] = [];
    let made = 0;
    for (let n = 1; n <= lines; n++) {
      actions.push(() => context.log('info', `${label} · line ${n} of ${lines}`));
      while (made < Math.floor((n * calls) / lines)) {
        made++;
        actions.push(call);
      }
    }
    while (made++ < calls) actions.push(call);
    return actions;
  }
}
