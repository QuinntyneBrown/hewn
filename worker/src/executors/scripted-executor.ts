import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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
  /** How many times that stage fails per project before it succeeds (every time when unset), so a retry can pass. */
  failTimes?: number;
  /** The failure's message. */
  failReason?: string;
  /** Stage whose main step opens a pull request on hewn/scaffold first, so Cancel has one to label (L2-029 AC3). */
  pullRequestStage?: number;
  /**
   * Stage whose main step writes git and npm credentials into its workspace, as a build's tools might, so the run's
   * end can be seen deleting them (L2-040 AC3; e2e, videos). The values are fake.
   */
  credentialsStage?: number;
}

/**
 * Deterministic stand-in for the real stage executors: every stage prepares, runs and commits, with no agent,
 * model or GitHub call. Used by the e2e stack and local demos until each stage's executor lands.
 */
export class ScriptedStageExecutor implements StageExecutor {
  private readonly options: ScriptedExecutorOptions;
  /** Failures so far of the fail stage, per project. */
  private readonly failures = new Map<string, number>();

  constructor(options: ScriptedExecutorOptions) {
    this.options = options;
  }

  plan(run: LeasedRun, context?: RunContext): StageStep[] {
    return [
      this.step('Prepare workspace'),
      this.step(
        `Run ${run.stageName}`,
        this.failure(run),
        context &&
          (this.options.logLines ||
            this.options.modelCalls ||
            run.stage === this.options.pullRequestStage ||
            run.stage === this.options.credentialsStage)
          ? {
              context,
              label: run.stageName,
              pullRequest: run.stage === this.options.pullRequestStage,
              credentials: run.stage === this.options.credentialsStage,
            }
          : undefined,
      ),
      this.step('Commit artifacts'),
    ];
  }

  /** The main step's failure for this run, if it should fail; counts it against `failTimes`. */
  private failure(run: LeasedRun): (() => string | undefined) | undefined {
    if (run.stage !== this.options.failStage) return undefined;
    return () => {
      const failed = this.failures.get(run.projectId) ?? 0;
      if (this.options.failTimes !== undefined && failed >= this.options.failTimes) return undefined;
      this.failures.set(run.projectId, failed + 1);
      return this.options.failReason ?? `Scripted failure in stage ${run.stage}`;
    };
  }

  private step(
    name: string,
    failure?: () => string | undefined,
    work?: { context: RunContext; label: string; pullRequest: boolean; credentials: boolean },
  ): StageStep {
    return {
      name,
      execute: async (signal) => {
        if (work) {
          if (work.pullRequest) await this.openPullRequest(work.context);
          if (work.credentials) await this.writeCredentials(work.context);
          const actions = this.actions(work.context, work.label);
          const gap = actions.length === 0 ? this.options.stepMs : this.options.stepMs / actions.length;
          if (actions.length === 0) await sleep(gap, signal);
          for (const action of actions) {
            await action();
            if (gap >= 1) await sleep(gap, signal);
            if (signal.aborted) throw signal.reason;
          }
        } else {
          await sleep(this.options.stepMs, signal);
        }
        if (signal.aborted) throw signal.reason;
        const message = failure?.();
        if (message) throw new Error(message);
      },
    };
  }

  private async writeCredentials(context: RunContext): Promise<void> {
    const token = 'ghs_' + 'ScriptedInstallationToken0123456789ab';
    await writeFile(join(context.workspace, '.git-credentials'), `https://x-access-token:${token}@github.com\n`);
    await writeFile(
      join(context.workspace, '.npmrc'),
      '//registry.npmjs.org/:_authToken=npm_ScriptedToken0123456789\n',
    );
    await context.log('info', `Wrote .git-credentials and .npmrc to ${context.workspace}`);
  }

  private async openPullRequest(context: RunContext): Promise<void> {
    const title = 'Scaffold the solution';
    const readme = { path: 'README.md', content: Buffer.from('# Scaffolded by the scripted executor\n') };
    await context.commit('scripted/commit', title, [readme], 'hewn/scaffold');
    await context.openPullRequest('scripted/pull-request', {
      head: 'hewn/scaffold',
      title,
      body: 'Generated by Hewn.',
    });
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
