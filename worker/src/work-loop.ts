import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BudgetReachedError, LeaseLostError, type HewnApi, type LeasedRun, type WorkerRegistration } from './api.ts';
import type { RunContext, StageExecutor } from './executors/stage-executor.ts';
import { LogBatcher } from './log-batcher.ts';
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
  /** How long each control poll is held open by the API. */
  controlWaitSeconds?: number;
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
  private readonly controlWaitSeconds: number;

  constructor(options: WorkLoopOptions) {
    this.api = options.api;
    this.executor = options.executor;
    this.registration = options.registration;
    this.log = options.log;
    this.pollIntervalMs = Math.max(options.pollIntervalMs ?? 15_000, 15_000);
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 10_000;
    this.controlWaitSeconds = options.controlWaitSeconds ?? 20;
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

    void this.listenForControl(workerId, run, lease);

    const logs = new LogBatcher(
      (lines) => this.api.log(workerId, run, lines),
      (error) => this.log('Could not send log lines', { runId: run.runId, error: messageOf(error) }),
    );

    // Synchronous on purpose: one small directory per run, and no I/O race with the heartbeat timer.
    const workspace = mkdtempSync(join(tmpdir(), `hewn-run-${run.runId}-`));
    const context: RunContext = {
      workspace,
      log: async (level, text) => logs.add({ level, text }),
      listSkillFolders: () => this.api.listSkillFolders(workerId, run),
      downloadRepository: () => this.api.downloadRepository(workerId, run),
      commit: (step, message, files, branch, options) =>
        this.api.commit(workerId, run, `${run.runId}/${step}/commit`, message, files, branch, options),
      nextIncrement: () => this.api.nextIncrement(workerId, run),
      updateIncrement: (number, update) => this.api.updateIncrement(workerId, run, number, update),
      openPullRequest: (step, request) =>
        this.api.openPullRequest(workerId, run, `${run.runId}/${step}/pull-request`, request),
      pullRequestChecks: (number) => this.api.pullRequestChecks(workerId, run, number),
      reportBacklog: (report) => this.api.reportBacklog(workerId, run, report),
      reportScope: (report) => this.api.reportScope(workerId, run, report),
      recordDecisions: (decisions) => this.api.recordDecisions(workerId, run, decisions),
      recordModelCall: async (call) => {
        const { verdict, directionSpendUsd, budgetUsd } = await this.api.recordModelCall(workerId, run, {
          callId: randomUUID(),
          ...call,
        });
        const spend = `${dollars(directionSpendUsd)} of ${dollars(budgetUsd)}`;
        if (verdict === 'Warn') logs.add({ level: 'warn', text: `Spend at 80% of budget (${spend})` });
        if (verdict === 'Stop') {
          // Hewn has paused the direction and released the lease; nothing more of this run may reach it.
          this.log('Budget reached; the direction is Paused', { runId: run.runId, spend });
          const reached = new BudgetReachedError(`Budget reached (${spend}).`);
          lease.abort(reached);
          throw reached;
        }
      },
      mergePullRequest: (step, number) =>
        this.api.mergePullRequest(workerId, run, `${run.runId}/${step}/merge`, number),
      protectDefaultBranch: (step, checks) =>
        this.api.protectDefaultBranch(workerId, run, `${run.runId}/${step}/protect`, checks),
    };

    try {
      const steps = this.executor.plan(run, context);
      for (let index = run.checkpointStep; index < steps.length; index++) {
        await this.api.startStep(workerId, run, index + 1, steps[index]!.name);
        await steps[index]!.execute(lease.signal);
        if (lease.signal.aborted) return;
        await logs.flush();
        const verdict = await this.api.checkpoint(workerId, run, index + 1);
        this.log('Checkpoint', { runId: run.runId, step: index + 1 });
        if (verdict === 'Pause') {
          // An Owner pressed Pause: Hewn has paused the direction at this checkpoint and released the lease.
          this.log('Paused at a checkpoint; the run stops here', { runId: run.runId, step: index + 1 });
          lease.abort(new Error('Paused at a checkpoint.'));
          return;
        }
      }

      if (lease.signal.aborted) return;
      await logs.close();
      await this.api.result(workerId, run, { outcome: 'Succeeded' });
      this.log('Run succeeded', { runId: run.runId, stage: run.stage });
    } catch (error) {
      if (lease.signal.aborted || error instanceof LeaseLostError) return;
      this.log('Run failed', { runId: run.runId, stage: run.stage });
      await logs.close();
      await this.api
        .result(workerId, run, { outcome: 'Failed', error: messageOf(error) })
        .catch((reportError: unknown) => this.log('Could not report the failure', { error: messageOf(reportError) }));
    } finally {
      // Ends the control poll as well.
      if (!lease.signal.aborted) lease.abort(new Error('The run ended.'));
      clearInterval(heartbeat);
      void logs.close();
      stop.removeEventListener('abort', onStop);
      rmSync(workspace, { recursive: true, force: true });
    }
  }

  /**
   * Holds the control poll open while the run executes. Cancel (L2-029 AC3) and Halt (Stop all workers, AC4) abort
   * the step in progress at once; the API has already taken the run back, so nothing more is reported. A halted run
   * keeps its checkpoint and is leased again after Start workers.
   */
  private async listenForControl(workerId: string, run: LeasedRun, lease: AbortController): Promise<void> {
    while (!lease.signal.aborted) {
      try {
        const control = await this.api.control(workerId, run, this.controlWaitSeconds, lease.signal);
        if (control === 'Cancel') {
          this.log('Cancelled; the run stops now', { runId: run.runId });
          lease.abort(new Error('Cancelled by an Owner.'));
          return;
        }
        if (control === 'Halt') {
          this.log('Halted: all workers stopped; the run waits at its checkpoint', { runId: run.runId });
          lease.abort(new Error('All workers stopped by an Owner.'));
          return;
        }
      } catch (error) {
        // A lost lease is the heartbeat's to handle; otherwise wait a little and poll again.
        if (lease.signal.aborted || error instanceof LeaseLostError) return;
        await sleep(1_000, lease.signal);
      }
    }
  }
}

function dollars(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
