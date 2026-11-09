import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LeaseLostError, type HewnApi, type LeasedRun, type WorkerRegistration } from './api.ts';
import type { RunContext, StageExecutor } from './executors/stage-executor.ts';
import { sleep } from './sleep.ts';

export type Log = (message: string, fields?: Record<string, unknown>) => void;

export interface WorkLoopOptions {
  api: HewnApi;
  executor: StageExecutor;
  registration: WorkerRegistration;
  log: Log;
  /** Idle polling interval; L2-026 allows no more often than every 15 seconds. */
  pollIntervalMs?: number;
  heartbeatIntervalMs?: number;
}

/**
 * Register, wait for work, lease one run, heartbeat while it executes, checkpoint after each step, report
 * the result, repeat. A lost lease (409, or two missed heartbeats) stops the run and nothing more is reported.
 */
export class WorkLoop {
  private readonly api: HewnApi;
  private readonly executor: StageExecutor;
  private readonly registration: WorkerRegistration;
  private readonly log: Log;
  private readonly pollIntervalMs: number;
  private readonly heartbeatIntervalMs: number;

  constructor(options: WorkLoopOptions) {
    this.api = options.api;
    this.executor = options.executor;
    this.registration = options.registration;
    this.log = options.log;
    this.pollIntervalMs = Math.max(options.pollIntervalMs ?? 15_000, 15_000);
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 10_000;
  }

  async run(signal: AbortSignal): Promise<void> {
    const workerId = await this.api.register(this.registration);
    this.log('Registered', { workerId, location: this.registration.location });

    while (!signal.aborted) {
      let run: LeasedRun | null = null;
      try {
        run = await this.api.lease(workerId);
      } catch (error) {
        this.log('Lease request failed', { error: messageOf(error) });
      }

      if (run === null) {
        await sleep(this.pollIntervalMs, signal);
        continue;
      }

      await this.execute(workerId, run, signal);
    }
  }

  private async execute(workerId: string, run: LeasedRun, stop: AbortSignal): Promise<void> {
    this.log('Leased run', {
      runId: run.runId,
      stage: run.stage,
      epoch: run.epoch,
      checkpointStep: run.checkpointStep,
    });
    const lease = new AbortController();
    const onStop = () => lease.abort(stop.reason);
    stop.addEventListener('abort', onStop, { once: true });

    let missed = 0;
    const heartbeat = setInterval(async () => {
      try {
        await this.api.heartbeat(workerId, run);
        missed = 0;
      } catch (error) {
        if (error instanceof LeaseLostError) {
          this.log('Lease lost', { runId: run.runId });
          lease.abort(error);
        } else if (++missed >= 2) {
          this.log('Two heartbeats missed; stopping the run', { runId: run.runId });
          lease.abort(new LeaseLostError('Two heartbeats missed.'));
        }
      }
    }, this.heartbeatIntervalMs);

    // Synchronous on purpose: one small directory per run, and no I/O race with the heartbeat timer.
    const workspace = mkdtempSync(join(tmpdir(), `hewn-run-${run.runId}-`));
    const context: RunContext = {
      workspace,
      log: (level, text) => this.api.log(workerId, run, [{ level, text }]),
      listSkillFolders: () => this.api.listSkillFolders(workerId, run),
      downloadRepository: () => this.api.downloadRepository(workerId, run),
      commit: (step, message, files, branch) =>
        this.api.commit(workerId, run, `${run.runId}/${step}/commit`, message, files, branch),
      openPullRequest: (step, request) =>
        this.api.openPullRequest(workerId, run, `${run.runId}/${step}/pull-request`, request),
      pullRequestChecks: (number) => this.api.pullRequestChecks(workerId, run, number),
      reportBacklog: (report) => this.api.reportBacklog(workerId, run, report),
      mergePullRequest: (step, number) =>
        this.api.mergePullRequest(workerId, run, `${run.runId}/${step}/merge`, number),
      protectDefaultBranch: (step, checks) =>
        this.api.protectDefaultBranch(workerId, run, `${run.runId}/${step}/protect`, checks),
    };

    try {
      const steps = this.executor.plan(run, context);
      for (let index = run.checkpointStep; index < steps.length; index++) {
        await steps[index]!.execute(lease.signal);
        if (lease.signal.aborted) return;
        await this.api.checkpoint(workerId, run, index + 1);
        this.log('Checkpoint', { runId: run.runId, step: index + 1 });
      }

      if (lease.signal.aborted) return;
      await this.api.result(workerId, run, { outcome: 'Succeeded' });
      this.log('Run succeeded', { runId: run.runId, stage: run.stage });
    } catch (error) {
      if (lease.signal.aborted || error instanceof LeaseLostError) return;
      this.log('Run failed', { runId: run.runId, stage: run.stage });
      await this.api
        .result(workerId, run, { outcome: 'Failed', error: messageOf(error) })
        .catch((reportError: unknown) => this.log('Could not report the failure', { error: messageOf(reportError) }));
    } finally {
      clearInterval(heartbeat);
      stop.removeEventListener('abort', onStop);
      rmSync(workspace, { recursive: true, force: true });
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
